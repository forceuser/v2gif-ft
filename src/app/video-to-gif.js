import path from "path";
import fs from "fs-extra";
import {Buffer} from "buffer";
import {URL} from "universal-url";
import {createCanvas, loadImage} from "canvas";
import {exec} from "shelljs";
import giflossy from "giflossy";
import ffmpeg from "ffmpeg-binaries";

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

function colorDistance (v1, v2) {
	let i;
	let d = 0;
	for (i = 0; i < v1.length; i++) {
		d += (v1[i] - v2[i]) * (v1[i] - v2[i]);
	}
	return Math.sqrt(d);
}

function colorAvg (colors) {
	const acc = colors.reduce((acc, i) => {
		for (let n = 0; n < 4; n++) {
			acc[n] += i[n];
		}
		return acc;
	}, [0, 0, 0, 0]);
	for (let n = 0; n < 4; n++) {
		acc[n] = Math.round(acc[n] / colors.length);
	}
	return acc;
}

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
	// find avg border color
	const topLeft = ctx.getImageData(0, 0, 1, 1).data;
	const bottomLeft = ctx.getImageData(0, h - 1, 1, 1).data;
	const topRight = ctx.getImageData(w - 1, 0, 1, 1).data;
	const bottomRight = ctx.getImageData(w - 1, h - 1, 1, 1).data;
	const avg = colorAvg([topLeft, bottomLeft, topRight, bottomRight]);
	console.log("avg", avg);
	// find crop coordinates
	const crop = getCrop();
	console.log("crop", crop);

	// const genPalleteCmd = `${ffmpeg} -i test.mov -an -filter_complex "[0:v] palettegen" -y palette.png`;
	// const genUnoptimizedCmd = `${ffmpeg} -i test.mov -i palette.png -an -filter_complex "fps=${fps},crop=${crop.x2 - crop.x1}:${crop.y2 - crop.y1}:${crop.x1}:${crop.y1},scale=230:-2:flags=lanczos[x];[x][1:v]paletteuse" -y unoptimized.gif`;
	const unoptimizedPath = path.resolve(__dirname, `${destPath}-unoptimized.gif`);
	const optimizedPath = path.resolve(__dirname, `${destPath}.gif`);
	const genOneStepCmd = `${ffmpeg} -i ${srcPath} -filter_complex "[0:v] fps=${fps},crop=${crop.x2 - crop.x1}:${crop.y2 - crop.y1}:${crop.x1}:${crop.y1},scale=${scaleWidth}:-2,split [a][b];[a] palettegen [p];[b][p] paletteuse${dither ? `=dither=${dither}` : ""}" -y ${unoptimizedPath}`;
	const genOptimizedCmd = `${giflossy} --optimize=3 --lossy=${compression} -o ${optimizedPath} ${unoptimizedPath}`;

	// console.log("generating gif pallete...");
	// await execAsync(genPalleteCmd);
	// console.log("generating unoptimized gif file...");
	// await execAsync(genUnoptimizedCmd);

	console.log("generating unoptimized gif file...");
	await execAsync(genOneStepCmd);
	console.log("optimizing gif...");
	await execAsync(genOptimizedCmd);
	fs.remove(`${destPath}-frame.png`);
	fs.remove(`${unoptimizedPath}`);
	return optimizedPath;

	function getCrop () {
		const pixels = ctx.getImageData(0, 0, w, h).data;
		const fuzz = 20;
		let x1 = w;
		let x2 = 0;
		let y1 = h;
		let y2 = 0;
		for (let y = 0; y < h; y++) {
			for (let x = 0; x < w; x++) {
				const idx = ((y * w) + x) * 4;
				const rgba = [pixels[idx], pixels[idx + 1], pixels[idx + 2], pixels[idx + 3]];
				if (colorDistance(rgba, avg) > fuzz) {
					if (y < y1) {
						y1 = y;
					}
					if (y > y2) {
						y2 = y;
					}
					if (x < x1) {
						x1 = x;
					}
					if (x > x2) {
						x2 = x;
					}
				}
			}
		}
		return {x1, y1, x2, y2};
	}
}


