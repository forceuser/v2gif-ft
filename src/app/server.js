import process from "process";
import cluster from "cluster";
import os from "os";
import {Worker} from "worker_threads";

import yargs from "yargs";
import path from "path";
import fs from "fs-extra";
import globby from "globby";

import multer from "multer";
import http from "http";
import https from "https";
import fetch from "node-fetch";
import FormData from "form-data";
import express from "express";
import serveIndex from "serve-index";
import serveStatic from "serve-static";
import morgan from "morgan";

import {videoToGif} from "./video-to-gif.js";
import Config from "./config.js";
import uuid from "uuid/v1.js";
import {getJSON, getPackageDir} from "../../build-utils/common.js";
import e from "express";

// console.log("process.mainModule", process.mainModule);
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const cwd = process.cwd();
const packageDir = getPackageDir();
const distDir = path.resolve(packageDir, "./dist/");
const uploadsDir = path.resolve(packageDir, "./uploads/");

const pkg = getJSON("./package.json");


const argv = yargs(process.argv.slice(2))
	.command("$0 [host] [port]", "start server",
		(yargs) => {
			yargs
				.positional("host", {
					alias: ["h", "ip", "l"],
					describe: "define host to listen to",
					type: "string",
				})
				.positional("port", {
					alias: ["p"],
					describe: "define server port",
					type: "string",
				});
		},
		(argv) => {
		})
	.help("help")
	.argv;


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

const app = {
	settings: new Config({
		delimiter: "-",
		format: "lowercase",
		alias: {
			"ip": "host",
			"server-host": "host",
			"server-ip": "host",
			"server-port": "port",
		},
		env: ["host", "port", "ip", "server-host", "server-ip", "server-port"],
		configs: [
			{type: "object", data: {port: 3000, host: "0.0.0.0", "trust-proxy": false}},
			{type: "object", data: pkg.settings},
			{type: "env", data: process.env},
			{type: "argv", data: argv},
		],
	}),
};

export default async function main () {
	const tasks = {};
	const fileNameMap = {};
	await cleanup();

	const expressApp = express();
	expressApp.set("trust proxy", app.settings.get("trust-proxy"));

	const router = express.Router();

	const upload = multer({dest: uploadsDir}).array("file");
	async function convert (fileInfo, options) {
		return await videoToGif(fileInfo.path, options);
	}

	router.get("/proxy-csp", async (req, res, next) => {
		const url = req.query.url;
		https.get(url, (response) => {
			res.header(Object.assign(response.headers, {"access-control-allow-origin": "*"}));
			response.pipe(res);
		});
	});

	async function addTask (id, req) {
		const _results = (req.files || []).map(async fileInfo => {
			try {
				await convert(fileInfo, {
					scaleWidth: req.query.scaleWidth == null ? 230 : req.query.scaleWidth,
					fps: req.query.fps == null ? 7 : req.query.fps,
					compression: req.query.compression == null ? 35 : req.query.compression,
					dither: req.query.dither,
				});
				const id = fileInfo.filename;
				const info = {
					id,
					original: path.parse(fileInfo.originalname).name,
					path: fileInfo.path,
					size: {
						gif: (await fs.stat(`${fileInfo.path}.gif`)).size,
						mp4: (await fs.stat(`${fileInfo.path}.mp4`)).size,
					},
				};
				fileNameMap[id] = info;
				console.log("fileInfo", fileInfo);
				return info;
			}
			finally {
				fs.remove(fileInfo.path);
			}
		});

		const errors = [];
		let results = await Promise.all(_results
			.map(i =>
				i.catch(error => {
					console.log("ERROR", error);
					return JSON.stringify(error);
				}
				))
		);
		results = results
			.filter((i, idx) => {
				if (typeof i === "string") {
					errors.push(JSON.parse(i));
				}
				return i;
			})
			.map(({id, original, size}) => ({id, original, size}));

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
		else {
			res.status(404).end();
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
	router.get("/file/:id.gif", (req, res, next) => {
		const urlInfo = fileNameMap[req.params.id];
		if (!urlInfo) {
			res.status(404).end();
			return;
		}
		try {
			res.status(200);
			res.header({"content-type": "image/gif"});
			res.header({"content-disposition": `attachment; filename="${urlInfo.original}.gif"`});
			fs.createReadStream(`${urlInfo.path}.gif`).pipe(res);
		}
		catch (error) {
			//
		}
	});

	router.get("/file/:id.mp4", (req, res, next) => {
		const urlInfo = fileNameMap[req.params.id];
		if (!urlInfo) {
			res.status(404).end();
			return;
		}
		try {

			res.status(200);
			res.header({"content-type": "video/mp4"});
			res.header({"content-disposition": `attachment; filename="${urlInfo.original}.mp4"`});
			fs.createReadStream(`${urlInfo.path}.mp4`).pipe(res);

		}
		catch (error) {
			//
		}
	});

	expressApp.use("/", router);
	// expressApp.use(morgan("dev"));

	const server = http.createServer(expressApp);
	const port = app.settings.get("port");
	const host = app.settings.get("host");

	server.listen(port, host, (req, res) => {
		const addr = server.address();
		console.log(`Server listening at http://${addr.address}:${addr.port}`);
		// if (cluster.isMaster) {
		// }
		// else {
		// 	console.log(`Subprocess(${process.pid}) of server (${process.ppid}) listening at http://${addr.address}:${addr.port}`);
		// }
	});
}
