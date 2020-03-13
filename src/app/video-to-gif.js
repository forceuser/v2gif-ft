import path from "path";
import fs from "fs-extra";
import {Buffer} from "buffer";
import {URL} from "universal-url";
import {createCanvas, loadImage} from "canvas";
import {exec} from "shelljs";
import gifsicleBinPath from "gifsicle";
import ffmpegBinPath from "ffmpeg-static";
import commandExists from "./command-exists.js";
import "colors";


export const getPoint = (x, y, imageData, alpha = true) => {
	const data = imageData.data;
	const i = (y * imageData.width * 4) + (x * 4);
	if (alpha) {
		return [
			data[i + 0],
			data[i + 1],
			data[i + 2],
			data[i + 3],
		];
	}
	else {
		return [
			data[i + 0],
			data[i + 1],
			data[i + 2],
		];
	}
};

function streamToString (stream) {
	const chunks = [];
	return new Promise((resolve, reject) => {
		stream.on("data", chunk => chunks.push(chunk));
		stream.on("error", reject);
		stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
	});
}

function execAsync (command, options = {}) {
	let resolve;
	let reject;
	exec(command, Object.assign({async: true, silent: true}, options), (code, stdout, stderr) => {
		if (code !== 0) {
			reject(stderr);
		}
		else {
			resolve(stdout);
		}
	});
	return new Promise((res, rej) => {
		resolve = res;
		reject = rej;
	});
}

const __dirname = path.dirname(new URL(import.meta.url).pathname);

function colorAvg (colors) {
	const acc = colors.reduce((acc, i) => {
		for (let n = 0; n < 3; n++) {
			acc[n] += i[n];
		}
		return acc;
	}, [0, 0, 0]);
	for (let n = 0; n < 3; n++) {
		acc[n] = Math.round(acc[n] / colors.length);
	}
	return acc;
}

function RGBArrayToHEX (color) {
	return color.reduce((str, chVal) => (str += Math.round(chVal).toString(16).padStart(2, "0"), str), "#");
}

function colorDistance (v1, v2) {
	let i;
	let d = 0;
	for (i = 0; i < v1.length; i++) {
		d += Math.pow(v1[i] - v2[i], 2);
	}

	const result = Math.sqrt(d);
	return result;
}

function removeLines (canvas) {
	const ctx = canvas.getContext("2d");
	const w = canvas.width;
	const h = canvas.height;
	const imageData = ctx.getImageData(0, 0, w, h);

	const same = [];
	for (let x = 0; x < w; x++) {
		let prevP;
		for (let y = 0; y < h; y++) {
			const p = getPoint(x, y, imageData);
			if (y > 0) {
				same[x] = (same[x] || y === 1) && colorDistance(p, prevP) === 0;
			}
			prevP = p;
		}
	}

	let x = 0;
	while (same[x])	{
		x++;
	}
	const left = Math.max(x - 1, 0);
	x = w - 1;
	while (same[x])	{
		x--;
	}
	const right = Math.min(x + 1, w);
	return {left, right, top: 0, bottom: h};
}


function getCrop (imageData, gap = 0) {
	const w = imageData.width;
	const h = imageData.height;
	let x1 = w;
	let x2 = 0;
	let y1 = h;
	let y2 = 0;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			if (getPoint(x, y, imageData)[3] > 50) {
				if (y < y1) {y1 = y;}
				if (y > y2) {y2 = y;}
				if (x < x1) {x1 = x;}
				if (x > x2) {x2 = x;}
			}
		}
	}
	const cropData = {
		left: Math.max(0, x1 - gap),
		top: Math.max(0, y1 - gap),
		right: Math.min(w, x2 + gap * 2),
		bottom: Math.min(h, y2 + gap * 2),
	};
	cropData.width = cropData.right - cropData.left;
	cropData.height = cropData.bottom - cropData.top;
	return cropData;
}

export function copyCanvas (canvas) {
	const c = createCanvas(canvas.width, canvas.height);
	c.getContext("2d").drawImage(canvas, 0, 0);
	return c;
}

function crop (canvas, rect) {
	const ctx = canvas.getContext("2d");
	const cpy = copyCanvas(canvas);
	canvas.width = rect.right - rect.left;
	canvas.height = rect.bottom - rect.top;
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.drawImage(cpy, rect.left, rect.top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
}
let gifsicle;
let ffmpeg;
async function init () {
	gifsicle = (await commandExists("gifsicle"))[0] || gifsicleBinPath;
	ffmpeg = (await commandExists("ffmpeg"))[0] || ffmpegBinPath;
	console.log("gifsicle bin".green, gifsicle);
	console.log("ffmpeg bin:".green, ffmpeg);
}
init();

export async function videoToGif (srcPath, {scaleWidth = 230, fps = 7, compression = 35, dither} = {}) {
	console.log("starting compression", srcPath);
	console.log("options", {scaleWidth, fps, compression, dither});
	const ext = path.extname(srcPath);
	const destPath = path.join(path.dirname(srcPath), path.basename(srcPath, ext));
	await execAsync(`${ffmpeg} -i ${srcPath} -vf select="eq(pict_type\\,I)" -vsync vfr -vframes 1 -q:v 2 -y ${destPath}-frame.png`);
	const image = await loadImage(path.resolve(__dirname, `${destPath}-frame.png`));
	const w = image.naturalWidth;
	const h = image.naturalHeight;
	console.log("imageLoaded", `${w}x${h}`);
	const canvas = createCanvas(w, h);
	const ctx = canvas.getContext("2d");
	ctx.drawImage(image, 0, 0);
	const lines = removeLines(canvas);
	console.log("LINES", lines);

	// find avg border color
	const topLeft = ctx.getImageData(0, 0, 1, 1).data;
	const bottomLeft = ctx.getImageData(0, h - 1, 1, 1).data;
	const topRight = ctx.getImageData(w - 1, 0, 1, 1).data;
	const bottomRight = ctx.getImageData(w - 1, h - 1, 1, 1).data;
	const avg = colorAvg([topLeft, bottomLeft, topRight, bottomRight]);
	console.log("avg", RGBArrayToHEX(avg));
	// find crop coordinates
	const linesData = removeLines(canvas);
	crop(canvas, linesData);

	const cropData = getCrop(ctx.getImageData(0, 0, canvas.width, canvas.height), 2);
	console.log("canvas.width", canvas.width, "canvas.height", canvas.height);
	console.log("cropData1", JSON.stringify(cropData));
	cropData.left = linesData.left + cropData.left;
	cropData.right = linesData.left + cropData.right;
	console.log("linesData", linesData);
	console.log("cropData2", cropData);



	const unoptimizedPath = path.resolve(__dirname, `${destPath}-unoptimized.gif`);
	const optimizedPath = path.resolve(__dirname, `${destPath}.gif`);
	const scale = false;
	const filters = `fps=${fps},crop=${cropData.right - cropData.left}:${cropData.bottom - cropData.top}:${cropData.left}:${cropData.top}${scale ? ",scale=${scaleWidth}:-2:flags=lanczos" : ""}`;
	const genPalleteCmd = `${ffmpeg} -i ${srcPath} -an -filter_complex "${filters},palettegen=stats_mode=full:max_colors=240:reserve_transparent=1:transparency_color=${RGBArrayToHEX(avg)}" -y ${destPath}-palette.png`;
	const genUnoptimizedCmd = `${ffmpeg} -i ${srcPath} -i ${destPath}-palette.png -an -filter_complex "${filters} [x];[x][1:v] paletteuse${dither ? `=dither=${dither}` : ""}" -y ${unoptimizedPath}`;

	// const genOneStepCmd = `${ffmpeg} -i ${srcPath} -filter_complex "[0:v] fps=${fps},crop=${crop.x2 - crop.x1}:${crop.y2 - crop.y1}:${crop.x1}:${crop.y1},scale=${scaleWidth}:-2,split [a][b];[a] palettegen [p];[b][p] paletteuse${dither ? `=dither=${dither}` : ""}" -y ${unoptimizedPath}`;
	const genOptimizedCmd = `${gifsicle} --optimize=3 --lossy=${compression} --resize-fit-width=${scaleWidth} -o ${optimizedPath} ${unoptimizedPath}`;

	// console.log("generating gif pallete...");
	// await execAsync(genPalleteCmd);
	// console.log("generating unoptimized gif file...");
	// await execAsync(genUnoptimizedCmd);

	console.log("generating unoptimized gif file...");
	await execAsync(genPalleteCmd);
	await execAsync(genUnoptimizedCmd);
	// await execAsync(genOneStepCmd);
	console.log("optimizing gif...", genOptimizedCmd);
	await execAsync(genOptimizedCmd);
	fs.remove(`${destPath}-frame.png`);
	fs.remove(`${destPath}-palette.png`);
	fs.remove(`${unoptimizedPath}`);
	return optimizedPath;
}


