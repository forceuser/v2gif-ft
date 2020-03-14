#!/usr/bin/env node
import process from "process";
import path from "path";
import fp from "find-free-port";
import fs from "fs-extra";
import os from "os";
import url from "url";
import yargs from "yargs";
import http2 from "http2";
import minimatch from "minimatch";
import merge from "deepmerge";
import webpack from "webpack";
import webpackDevMiddleware from "webpack-dev-middleware";
import webpackHotMiddleware from "webpack-hot-middleware";
import webpackConfigRawDev from "../webpack/development.config.js";
import webpackConfigRawProd from "../webpack/production.config.js";
import proxyMiddleware from "http-proxy-middleware";
import {getPackageDir, getJSON} from "./common.js";
import invokeMiddleware from "./invoke-middleware.js";
// import {URL} from "universal-url";
import browserSync from "browser-sync";
import syncDir from "sync-directory";
import open from "open";
import colors from "colors";
import ngrok from "ngrok";
import cmdExists from "./command-exists.js";

const cwd = process.cwd();
const argv = yargs
	.alias("port", "p")
	.describe("port", "port to start dev server")
	.env("DEV_ENV")
	.option("env", {alias: "env"})
	.help("help")
	.argv;


function get (src, path) {
	const p = path.replace(/["']/g, "").replace(/\[/g, ".").replace(/\]/g, "").split(".");
	let c = src;
	if (p[0]) {
		for (let i = 0; i < p.length; i++) {
			if (i === p.length - 1) {
				return c[p[i]];
			}
			c = c[p[i]];
			if (c == null || typeof c !== "object") {
				return undefined;
			}
		}
	}
	return c;
}

function tpl (tpl, params) {
	tpl = tpl.replace(/\$\{(.*?)\}/igm, (all, param) => {
		const p = get(params, param);
		return p == null ? `[${param}]` : p;
	});
	return tpl;
}

function fileExists (path) {
	try {
		if (fs.existsSync(path)) {
			return true;
		}
	}
	catch (err) {
		console.error(err);
	}
	return false;
}


const packageDir = getPackageDir();
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const devSettingsDefault = {host: "0.0.0.0"};
const pkg = getJSON("package.json");
let devSettings = merge(merge(devSettingsDefault, pkg.devSettings || {}), getJSON("devserver.json"));

if (argv.env) {
	argv.env.split(",").forEach(env => {
		if (devSettings.env && devSettings.env[env]) {
			devSettings = merge(devSettings, devSettings.env[env]);
		}
	});
}

const ifc = os.networkInterfaces();

async function runOnPort (port) {
	devSettings.baseDir = devSettings.baseDir || "./dist/";
	devSettings.watchFiles = devSettings.watchFiles || ["dist/**/*"];
	devSettings.spaPaths = devSettings.spaPaths || [];

	const proxyMiddlewares = devSettings.proxy ? [
		proxyMiddleware("**", {
			target: tpl(devSettings.proxy, devSettings),
			secure: false,
			changeOrigin: devSettings.changeOrigin !== false,
		}),
	] : [];

	const webpackConfigRaw = webpackConfigRawDev;
	// webpackConfigRaw = webpackConfigRawProd;
	const webpackConfigs = (devSettings.webpackEnv || [{}]).map(env => {
		return typeof webpackConfigRaw === "function" ? webpackConfigRaw(env) : webpackConfigRaw;
	});
	const firstWebpackConfig = webpackConfigs[0];
	const webpackCompiler = webpack(webpackConfigs.length === 1 ? firstWebpackConfig : webpackConfigs);
	const webpackDevInstance = webpackDevMiddleware(webpackCompiler, {
		publicPath: firstWebpackConfig.output.publicPath,
		stats: "errors-only",
	});
	const webpackCompiled = new Promise(resolve => webpackDevInstance.waitUntilValid(() => resolve()));

	const webpackMiddlewares = [
		async (req, res, next) => {
			// res.setHeader("Cache-Control", "max-age=31557600");
			return next();
		},
		webpackDevInstance,
		webpackHotMiddleware(webpackCompiler, {
			path: "/__webpack_hmr",
			reload: true,
		}),
	];

	const middleware = [
		...webpackMiddlewares,
		async (req, res, next) => {

			let fileName = url.parse(req.url);
			fileName = fileName.href.split(fileName.search).join("");
			let match;

			if (devSettings.rewrite) {
				for (const src of Object.keys(devSettings.rewrite)) {
					if (minimatch(fileName, src)) {
						req.url = devSettings.rewrite[src];
						return next();
					}
				}
			}

			if (devSettings.spaPaths && devSettings.spaPaths.some(key => minimatch(fileName, key))) {
				req.url = `/`;

				return next();
			}

			match = fileName.match(/^\/resources\/[^/\\]+\/js\/(.*)/);
			if (match && match[1]) {
				req.url = `/resources/${pkg.version}/js/${match[1]}`;
				// res.setHeader("Cache-Control", "max-age=31557600");
				return invokeMiddleware(webpackMiddlewares, req, res)
					.then(() => {
						// file not found on webpackMiddleware virtual file system
						req.url = `/js/${match[1]}`;
						return next();
					});
			}

			match = fileName.match(/^\/resources\/[^/\\]+\/(.*)/);
			if (match && match[1]) {
				req.url = `/${match[1]}`;
				return next();
			}

			match = fileName.match(/^\/res\/(.*)/);
			if (match && match[1]) {
				req.url = `/${match[1]}`;
				return next();
			}

			let pathExists;
			try {
				const p = path.resolve(packageDir, devSettings.baseDir, req.url.replace(/^\//, ""));
				const stat = (await fs.stat(p));
				if (stat.isFile()) {
					return next();
				}
				else if (stat.isDirectory() && devSettings.indexFiles) {
					const indexFiles = devSettings.indexFiles === true ? ["index.html"] : devSettings.indexFiles;
					for (let i = 0; i < indexFiles.length; i++) {
						const idx = indexFiles[i];
						if (await fs.exists(path.resolve(p, idx))) {
							req.url = req.url.replace(/^\//, "/" + idx);
							return next();
						}
					}
				}
			}
			catch (error) {
				//
			}

			if (proxyMiddlewares.length) {
				return invokeMiddleware(proxyMiddlewares, req, res);
			}
			else {
				return next();
			}
		},
	];

	const bs = browserSync.create();
	const bsInited = new Promise(resolve =>
		bs.init({
			open: false,
			notify: false,
			// online: false,
			// localOnly: true,
			// host: devSettings.host,
			port,
			files: devSettings.watchFiles,
			// watchEvents: ["change", "add", "unlink"],
			reloadDebounce: 300,
			ghostMode: {
				clicks: false,
				forms: false,
				scroll: false,
			},
			watchOptions: {
				awaitWriteFinish: true,
			},
			server: {
				baseDir: path.resolve(packageDir, devSettings.baseDir),
				middleware,
			},
			snippetOptions: {
				// ignorePaths: "/**/*",
				rule: {
					match: /<\/head>/i,
					fn (snippet, match) {
						// console.log("snippet", snippet, this);
						// snippet.replace("id=", `nonce="%browsersync-nonce%" id=`) +
						return match;
					},
				},
			},
			rewriteRules: [{
				match: /<\/head>/ig,
				fn (req, res, match) {
					// res.setHeader("Set-Cookie", "HttpOnly;Secure;SameSite=Strict");

					console.log("rewrite", res.hasHeader("content-security-policy"));
					let nonce;
					try {
						if (res.hasHeader("content-security-policy")) {
							const headers = res.getHeaders();
							nonce = headers["content-security-policy"].match(/script-src[^;]*?['"]nonce-(.+?)['"]/)[1] || "";
						}
					}
					catch (error) {
						//
					}
					return `<script async${nonce ? ` nonce="${nonce}"` : ""} src="/browser-sync/browser-sync-client.js?v=2.26.7"></script>${match}`;
					// return match;
				},
			}],
		}, resolve));
	//  bs.emitter.on("init", () => resolve()));

	if (devSettings.syncDir) {
		Object.keys(devSettings.syncDir).map((src) => {
			const target = devSettings.syncDir[src];
			console.log("syncing dir".magenta, src.cyan, "->".green, target.blue);
			syncDir(path.resolve(packageDir, src), path.resolve(packageDir, target), {watch: true, type: "copy", afterSync: (event) => {
				console.log("[sync] ".brightGreen, event.relativePath.yellow);
			}});
		});
	}

	let ngrokUrl;
	if (typeof ngrok && devSettings.serveExternal === true || get(devSettings, "serveExternal.enabled") === true) {
		try {
			let dir;
			try {
				const ngrokLocalBin = await cmdExists("ngrok");
				dir = path.dirname(ngrokLocalBin);
				console.log("found local version of ngrok", ngrokLocalBin);
			}
			catch (error) {
				console.log("NGROK ERROR", error);
			}

			ngrokUrl = await ngrok.connect(
				Object.assign(typeof devSettings.serveExternal === "object" ? devSettings.serveExternal : {}, {dir, port})
			);
		}
		catch (error) {
			console.log("ngrok error", error);
		}
	}

	bsInited.then(() => {
		// if (devSettings.host === "0.0.0.0") {
		Object.keys(ifc).forEach(i => {
			(ifc[i] || []).forEach(x => {
				if (x.family === "IPv4") {
					console.log(`listening at http://${x.address}:${port}`);
				}
			});
		});


		if (devSettings.serveExternal) {
			console.log(`listening at ${ngrokUrl}`);
		}
	});

	if (devSettings.open) {
		Promise.all([bsInited, webpackCompiled])
			.then(() => {
				console.log("opening", tpl(devSettings.open, devSettings));
				setTimeout(() => {
					open(tpl(devSettings.open, devSettings));
				}, 1000);
			});
	}
}
if (argv.port || devSettings.port) {
	runOnPort(argv.port || devSettings.port);
}
else {
	fp(8080).then(async ([port]) => {
		runOnPort(port);
	})
		.catch(error => {
			console.log("ERROR", error);
		});
}
