import path from "path";
import childProcess from "child_process";
import isWsl from "is-wsl";
import process from "process";
import {URL} from "universal-url";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

export default function (target, opts) {
	if (typeof target !== "string") {
		return Promise.reject(new Error("Expected a `target`"));
	}

	opts = Object.assign({wait: true}, opts);

	let cmd;
	let appArgs = [];
	let args = [];
	const cpOpts = {};

	if (Array.isArray(opts.app)) {
		appArgs = opts.app.slice(1);
		opts.app = opts.app[0];
	}

	if (process.platform === "darwin") {
		cmd = "open";

		if (opts.wait) {
			args.push("-W");
		}

		if (opts.app) {
			args.push("-a", opts.app);
		}
	}
	else if ((process.platform === "win32" || isWsl) && (!opts.bash)) {
		cmd = "cmd" + (isWsl ? ".exe" : "");
		args.push("/c", "start", "\"\"", "/b");
		target = target.replace(/&/g, "^&");

		if (opts.wait) {
			args.push("/wait");
		}

		if (opts.app) {
			args.push(opts.app);
		}

		if (appArgs.length > 0) {
			args = args.concat(appArgs);
		}
	}
	else {
		if (opts.app) {
			cmd = opts.app;
		}
		else {
			cmd =
				process.platform === "android"
					? "xdg-open"
					: path.join(__dirname, "xdg-open");
		}

		if (appArgs.length > 0) {
			args = args.concat(appArgs);
		}

		if (!opts.wait) {
			// `xdg-open` will block the process unless
			// stdio is ignored and it's detached from the parent
			// even if it's unref'd
			cpOpts.stdio = "ignore";
			cpOpts.detached = true;
		}
	}

	args.push(target);

	if (process.platform === "darwin" && appArgs.length > 0) {
		args.push("--args");
		args = args.concat(appArgs);
	}

	const cp = childProcess.spawn(cmd, args, {stdio: [process.stdin, process.stdout, process.stderr]});

	if (opts.wait) {
		return new Promise((resolve, reject) => {
			cp.once("error", reject);

			cp.once("close", code => {
				if (code > 0) {
					reject(new Error("Exited with code " + code));
					return;
				}

				resolve(cp);
			});
		});
	}

	cp.unref();

	return Promise.resolve(cp);
}
