/* global process */
import {default as fetchInterceptors, initFetch} from "./fetch-interceptors";
// import "isomorphic-fetch";
import path from "path";
import FormData from "form-data";
import multer from "multer";
import http from "http";
import fs from "fs-extra";
import express from "express";
import serveIndex from "serve-index";
import serveStatic from "serve-static";
import morgan from "morgan";
import {JSDOM} from "jsdom";
import https from "https";
import yargs from "yargs";
import globby from "globby";
import {videoToGif} from "./video-to-gif";
import {URL} from "universal-url";
import invokeMiddleware from "./invoke-middleware";
import uuid from "uuid/v1";

// console.log("process.mainModule", process.mainModule);
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const cwd = process.cwd();
const distDir = path.resolve(__dirname, "../../dist/");
const uploadsDir = path.resolve(__dirname, "../../uploads/");

const argv = yargs.alias("port", "p")
	.describe("port", "define server port")
	.alias("host", "h")
	.alias("host", "ip")
	.alias("host", "l")
	.describe("host", "define host to listen to")
	.help("help")
	.argv;

fetchInterceptors.register({
	async response (response, request) {
		const res = response.clone();
		const contentType = res.headers.get("content-type");
		if (contentType && contentType.includes("application/json")) {
			const data = await res.json();
			if (data.asyncPending) {
				return new Promise((resolve, reject) => {
					setTimeout(() => {
						fetch(request.url, request).then(resolve, reject);
					}, 2000);
				});
			}
		}

		return response;
	},
});

async function cleanup () {
	try {
		const paths = (await globby(["./**/*"], {cwd: uploadsDir})).map(p => path.resolve(uploadsDir, p));
		await Promise.all(paths.map(p => fs.remove(p)));
		console.log("cleanup finished");
	}
	catch (error) {
		console.log("error while cleaning uploads directory", error);
	}
}

async function getForm ({url, file, fileInfo}) {
	const body = new FormData();
	if (file) {
		body.append("new-image", file, {
			filename: fileInfo.originalname,
			filepath: `photos/${fileInfo.originalname}`,
			knownLength: fileInfo.size,
			contentType: fileInfo.mimetype,
		});
		body.append("new-image-url", "");
		body.append("upload", "Upload video!");
	}
	const html = await fetch(url, {
		method: "POST",
		redirect: "follow",
		headers: {
			"Referer": url,
			"Cookie": "_ga=GA1.2.997457162.1536663984; _gid=GA1.2.1399128699.1536663984",
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:62.0) Gecko/20100101 Firefox/62.0",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3",
			"Upgrade-Insecure-Requests": "1",
		},
		body,
	})
		.then(response => {
			console.log(`Form received: ${response.url}`);
			return response.text();
		});
	const dom = new JSDOM(html);
	const form = dom.window.document.querySelector(".form.ajax-form");
	if (form) {
		const tmp = (form.action || "").split("/");
		const id = tmp[tmp.length - 1];
		const token = (form.querySelector(`input[name="token"]`) || {}).value || "";
		const filestats = (dom.window.document.querySelector(".filestats") || {}).textContent || "";
		return {id, token, filestats, url};
	}
}

async function commitForm ({stage, id, token, data, nextStage = "save"}) {
	const body = new FormData();
	Object.keys(data).forEach(key => {
		body.append(key, data[key]);
	});
	body.append("file", id);
	body.append("token", token);
	const html = await fetch(`https://s3.ezgif.com/${stage}/${id}?ajax=true`, {
		method: "POST",
		redirect: "follow",
		headers: {
			"Referer": `https://s3.ezgif.com/${stage}`,
			"Cookie": "_ga=GA1.2.997457162.1536663984; _gid=GA1.2.1399128699.1536663984",
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:62.0) Gecko/20100101 Firefox/62.0",
			"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3",
			"Upgrade-Insecure-Requests": "1",
		},
		body,
	})
		.then(response => {
			console.log(`${stage} commited: ${response.url}`);
			return response.text();
		});
	const dom = new JSDOM(html);
	const links = [...dom.window.document.querySelector(".file-menu").querySelectorAll("a")];
	const linkMap = links.reduce((acc, i) => (acc[i.href.split("/")[3]] = i.href, acc), {});
	return linkMap[nextStage];
}


initFetch().then(async () => {
	const fileNameMap = {};
	await cleanup();

	const app = express();
	app.set("trust proxy", true);

	const router = express.Router();

	const upload = multer({dest: uploadsDir}).array("file");
	async function convert (fileInfo, options) {
		return await videoToGif(fileInfo.path, options);
	}

	async function ezgif (fileInfo) {
		const file = await fs.readFile(fileInfo.path);

		const stages = [
			{id: "crop-video", data: {
				x1: 726,
				y1: 67,
				x2: 1194,
				y2: 1011,
				w: 468,
				h: 944,
				encoding: "original",
			}},
			{id: "resize-video", data: {
				old_width: 468,
				old_height: 944,
				width: 230,
				height: "",
				percentage: 49.15,
				encoding: "original",
			}},
			{id: "video-to-gif", data: formData => {
				const [durationStr, hours, minutes, seconds] = formData.filestats.match(/(\d\d):(\d\d):(\d\d)/im);
				return {
					start: 0,
					end: ((+hours * 60 * 60) + (+minutes * 60) + (+seconds + 1)),
					size: "original",
					fps: 7,
					method: "ffmpeg",
				};
			}},
			{id: "optimize", data: {
				method: "gifsicle",
				colors: 200,
				lossy: 35,
				fuzz: 3,
			}},
		];

		const downloadUrl = await stages.reduce(async (acc, stage, idx) => {
			let url = await acc;
			let formData;
			if (!url) {
				url = `https://s3.ezgif.com/${stage.id}`;
				formData = await getForm({url, file, fileInfo});
			}
			else {
				formData = await getForm({url});
			}
			return await commitForm({
				stage: stage.id,
				id: formData.id,
				token: formData.token,
				data: typeof stage.data === "function" ? stage.data(formData) : stage.data,
				nextStage: (stages[idx + 1] || {}).id || "save",
			});
		}, Promise.resolve());
		return downloadUrl;
	}

	router.get("/proxy-csp", async (req, res, next) => {
		const url = req.query.url;
		https.get(url, (response) => {
			res.header(Object.assign(response.headers, {"access-control-allow-origin": "*"}));
			response.pipe(res);
		});
		// return invokeMiddleware([
		// 	proxyMiddleware("**", {
		// 		target: url,
		// 		secure: false,
		// 		changeOrigin: false,
		// 		onProxyRes (proxyRes, req, res) {
		// 			proxyRes.headers["access-control-allow-origin"] = "*";
		// 		}
		// 	})
		// ], req, res);
	});

	router.post("/post", upload, async (req, res, next) => {
		const isEzgif = "ezgif" in req.query;
		const _results = (req.files || []).map(async fileInfo => {
			try {
				console.log("req.query", req.query);
				console.log("fileInfo", fileInfo);
				const downloadUrl = isEzgif
					? (await ezgif(fileInfo))
					: (await convert(fileInfo, {
						scaleWidth: req.query.scaleWidth == null ? 230 : req.query.scaleWidth,
						fps: req.query.fps == null ? 7 : req.query.fps,
						compression: req.query.compression == null ? 35 : req.query.compression,
						dither: req.query.dither,
					}));
				const destName = path.parse(downloadUrl);
				const downName = path.parse(fileInfo.originalname);
				const name = `${destName.name || ""}${destName.ext || ""}`;
				const info = {
					name,
					download: `${downName.name || ""}${destName.ext || ""}`,
					url: downloadUrl,
					size: (await fs.stat(downloadUrl)).size,
					isEzgif,
				};
				fileNameMap[name] = info;
				console.log("fileInfo", fileInfo);
				return info;
			}
			finally {
				fs.remove(fileInfo.path);
			}
		});

		const errors = [];
		let results = await Promise.all(_results.map(i => i.catch(error => {
			return JSON.stringify(error);
		})));
		results = results
			.filter((i, idx) => {
				if (typeof i === "string") {
					errors.push(JSON.parse(i));
				}
				return i;
			})
			.map(({name, download, size}) => ({name, download, size}));
		res.status(200).json({
			results,
			errors,
		});
	});

	const tasks = {};

	async function addTask (id, req) {
		const _results = (req.files || []).map(async fileInfo => {
			try {
				const downloadUrl =	await convert(fileInfo, {
					scaleWidth: req.query.scaleWidth == null ? 230 : req.query.scaleWidth,
					fps: req.query.fps == null ? 7 : req.query.fps,
					compression: req.query.compression == null ? 35 : req.query.compression,
					dither: req.query.dither,
				})
				const destName = path.parse(downloadUrl);
				const downName = path.parse(fileInfo.originalname);
				const name = `${destName.name || ""}${destName.ext || ""}`;
				const info = {
					name,
					download: `${downName.name || ""}${destName.ext || ""}`,
					url: downloadUrl,
					size: (await fs.stat(downloadUrl)).size,
					isEzgif: false,
				};
				fileNameMap[name] = info;
				console.log("fileInfo", fileInfo);
				return info;
			}
			finally {
				fs.remove(fileInfo.path);
			}
		});

		const errors = [];
		let results = await Promise.all(_results.map(i =>
			i.catch(error => {
				console.log("ERROR", error);
				return JSON.stringify(error);
			}
		)));
		results = results
			.filter((i, idx) => {
				if (typeof i === "string") {
					errors.push(JSON.parse(i));
				}
				return i;
			})
			.map(({name, download, size}) => ({name, download, size}));
		tasks[id].resolved = true;
		return {results, errors};
	}

	router.get("/task/:id", upload, async (req, res, next) => {
		const id = req.params.id;
		if (tasks[id]) {
			if (tasks[id].resolved) {
				const result = await tasks[id].promise;
				res.status(200).json({result, resolved: true});
			}
			else {
				res.status(200).json({resolved: false});
			}
		}
	});

	router.post("/task", upload, async (req, res, next) => {
		const id = uuid();
		tasks[id] = {
			promise: addTask(id, req),
			resolved: false,
		};
		res.status(200).json({id});
	});


	router.use("/", serveStatic(distDir), serveIndex(distDir));
	router.get("/img/:id", (req, res, next) => {
		const urlInfo = fileNameMap[req.params.id];
		try {
			if (urlInfo.isEzgif) {
				https.get(urlInfo.url, (response) => {
					res.status(200);
					res.header({"content-type": "image/gif"});
					res.header({"content-disposition": `attachment; filename="${urlInfo.download}"`});
					response.pipe(res);
				});
			}
			else {
				res.status(200);
				res.header({"content-type": "image/gif"});
				res.header({"content-disposition": `attachment; filename="${urlInfo.download}"`});
				fs.createReadStream(urlInfo.url).pipe(res);
			}
		}
		catch (error) {
			//
		}
	});

	app.use("/", router);
	// app.use(morgan("dev"));

	const server = http.createServer(app);
	const port = argv.port || process.env.PORT || process.env.SERVER_PORT || 8080;
	const host = argv.host || process.env.SERVER_HOST || process.env.IP || "0.0.0.0";
	console.log("before listen", port, host);
	server.listen(port, host, (req, res) => {
		const addr = server.address();

		console.log(`Web server listening at http://${addr.address}:${addr.port}`);
	});
});
