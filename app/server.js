/* global process */
// import {default as fetchInterceptors, initFetch} from "./fetch-interceptors";
import "isomorphic-fetch";
import FormData from "form-data";
import multer from "multer";
import http from "http";
import fs from "fs-extra";
import express from "express";
import serveIndex from "serve-index";
import serveStatic from "serve-static";
import morgan from "morgan";
import {JSDOM} from "jsdom";

// import webpackDevMiddleware from "webpack-dev-middleware";
// import webpackHotMiddleware from "webpack-hot-middleware";
// import webpack from "webpack";
// import webpackConfig from "../webpack/development.config";

// fetchInterceptors.register({
// 	async response (response, request) {
// 		const res = response.clone();
// 		const contentType = res.headers.get("content-type");
// 		console.log("INTERCEPTED!");
// 		if (contentType && contentType.includes("application/json")) {
// 			const data = await res.json();
// 			if (data.asyncPending) {
// 				return new Promise((resolve, reject) => {
// 					setTimeout(() => {
// 						fetch(request.url, request).then(resolve, reject);
// 					}, 2000);
// 				});
// 			}
// 		}

// 		return response;
// 	},
// });

async function getForm ({url, file, fileInfo}) {
	const body = new FormData();
	const urls = {};
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
			console.log(`UPLOADED TO ${response.url}`);
			return response.text();
		})
		.catch(error => {
			console.log("ERROR UPLOADING", error);
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
			console.log(`UPLOADED TO ${response.url}`);
			return response.text();
		})
		.catch(error => {
			console.log("ERROR UPLOADING", error);
		});
	const dom = new JSDOM(html);
	const links = [...dom.window.document.querySelector(".file-menu").querySelectorAll("a")];
	const linkMap = links.reduce((acc, i) => (acc[i.href.split("/")[3]] = i.href, acc), {});
	return linkMap[nextStage];
}

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

// initFetch().then(async () => {
const app = express();
// app.set('trust proxy', true);

const router = express.Router();

// console.log(import.meta);
const upload = multer({dest: "./uploads/"}).array("file");
router.post("/post", upload, async (req, res, next) => {
	const results = (req.files || []).map(async fileInfo => {
		const file = await fs.readFile(fileInfo.path);
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
	});
	Promise.all(results.map(i => i.catch(error => console.log(error)))).then(results => {
		res.status(200).json(results);
	});
	// console.log("file", req);
});
router.use("/", serveStatic("./app/static"), serveIndex("./app/static"));
// const webpackCompiler = webpack(webpackConfig);
// router.use(webpackDevMiddleware(webpackCompiler, {
// 	// publicPath: "/dist/",
// }));
// router.use(webpackHotMiddleware(webpackCompiler, {
// 	path: "/__webpack_hmr",
// 	reload: true,
// }));

app.use("/", router);
app.use(morgan("dev"));

const server = http.createServer(app);

server.listen(process.env.SERVER_PORT || 3000, process.env.SERVER_HOST || "0.0.0.0", (req, res) => {
	const addr = server.address();

	console.log(`Web server listening at http://${addr.address}:${addr.port}`);
});

// const form = new FormData();
// form.append("new-image");
// const data = await fetch(`https://ezgif.com/`).then(response =>
// 	response.text()
// );
// console.log("data", data);
// });

console.log("ITS WORKING");
