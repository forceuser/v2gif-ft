/* global process */
import {default as fetchInterceptors, initFetch} from "./fetch-interceptors";
import FormData from "form-data";
import multer from "multer";
import http from "http";
import express from "express";
import serveIndex from "serve-index";
import serveStatic from "serve-static";
import morgan from "morgan";
// import webpackDevMiddleware from "webpack-dev-middleware";
// import webpackHotMiddleware from "webpack-hot-middleware";
// import webpack from "webpack";
// import webpackConfig from "../webpack/development.config";

fetchInterceptors.register({
	async response (response, request) {
		const res = response.clone();
		const contentType = res.headers.get("content-type");
		console.log("INTERCEPTED!");
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

initFetch().then(async () => {
	const app = express();
	// app.set('trust proxy', true);

	const router = express.Router();

	console.log(import.meta);
	const upload = multer({dest: "./uploads/"}).array("file");
	router.post("/post", upload, async (req, res, next) => {
		(req.files || []).forEach(async file => {

		});
		console.log("file", req);
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
});

console.log("ITS WORKING");
