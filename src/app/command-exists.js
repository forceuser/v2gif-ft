import process from "process";
import path from "path";
import {exec, execSync} from "child_process";
import {default as fs, access, accessSync, constants} from "fs";
import {getPackageDir} from "./common.js";

const cwd = process.cwd();
const packageDir = getPackageDir();

const isUsingWindows = process.platform == "win32";

function getPATHKey () {
	let PATH = "PATH";

	if (isUsingWindows) {
		PATH = "Path";
		Object.keys(process.env).forEach((e) => {
			if (e.match(/^PATH$/i)) {
				PATH = e;
			}
		});
	}
	return PATH;
}


function getPATHSeparator () {
	return process.platform === isUsingWindows ? ";" : ":";
}

function replacePackageBinPath (env) {
	const separator = getPATHSeparator();
	const pathKey = getPATHKey();

	env[pathKey] = env[pathKey].split(separator).reduce((res, item) => {
		if (!item.startsWith(packageDir)) {
			res.push(item);
		}
		return res;
	}, [])
		.join(separator);
	return env;
}

const localExecutable = function (commandName, callback) {
	const localFilePath = path.resolve(cwd, commandName);
	access(localFilePath, constants.F_OK | constants.X_OK, error => callback(error, localFilePath));
};

const localExecutableSync = function (commandName) {
	const localFilePath = path.resolve(cwd, commandName);
	accessSync(localFilePath, constants.F_OK | constants.X_OK);
	return localFilePath;
};


const commandExistsUnix = function (commandName, cleanedCommandName, callback) {

	localExecutable(commandName, (error, filePath) => {
		if (error) {
			exec("command -v " + cleanedCommandName +
                  " 2>/dev/null" +
                  " && { echo >&1 " + cleanedCommandName + "; exit 0; }", {
				env: replacePackageBinPath(process.env),
			}, (error, stdout) => callback(error, stdout.toString().split(/\s+/).filter(i => i.trim())));
		}
		else {
			callback(error, filePath);
		}
	});
};

const commandExistsWindows = function (commandName, cleanedCommandName, callback) {
	if (/[\x00-\x1f<>:"\|\?\*]/.test(commandName)) {
		callback(true, "");
		return;
	}
	localExecutable(commandName, (error, filePath) => {
		if (error) {
			exec("where " + cleanedCommandName, (error, stdout) => callback(error, stdout.toString().split(/\s+/).filter(i => i.trim())));
		}
		else {
			callback(error, filePath);
		}
	});
};

const commandExistsUnixSync = function (commandName, cleanedCommandName) {
	try {
		return localExecutableSync(commandName);
	}
	catch {}
	return execSync(`command -v ${cleanedCommandName} 2>/dev/null`).toString().split(/\s+/).filter(i => i.trim());
};

const commandExistsWindowsSync = function (commandName, cleanedCommandName) {
	if (/[\x00-\x1f<>:"\|\?\*]/.test(commandName)) {
		return false;
	}
	try {
		return localExecutableSync(commandName);
	}
	catch {}
	return execSync("where " + cleanedCommandName, {stdio: []}).toString().split(/\s+/).filter(i => i.trim());
};

let cleanInput = function (s) {
	if (/[^A-Za-z0-9_\/:=-]/.test(s)) {
		s = "'" + s.replace(/'/g, "'\\''") + "'";
		s = s.replace(/^(?:'')+/g, "") // unduplicate single-quote at the beginning
			.replace(/\\'''/g, "\\'"); // remove non-escaped single-quote if there are enclosed between 2 escaped
	}
	return s;
};

if (isUsingWindows) {
	cleanInput = function (s) {
		const isPathName = /[\\]/.test(s);
		if (isPathName) {
			const dirname = "\"" + path.dirname(s) + "\"";
			const basename = "\"" + path.basename(s) + "\"";
			return dirname + ":" + basename;
		}
		return "\"" + s + "\"";
	};
}

export default function commandExists (commandName, callback) {
	const cleanedCommandName = cleanInput(commandName);
	if (!callback && typeof Promise !== "undefined") {
		return new Promise(((resolve, reject) => {
			commandExists(commandName, (error, output) => {
				if (error) {
					reject(error);
				}
				else {
					resolve(output);
				}
			});
		}));
	}
	if (isUsingWindows) {
		commandExistsWindows(commandName, cleanedCommandName, callback);
	}
	else {
		commandExistsUnix(commandName, cleanedCommandName, callback);
	}
}

export function sync (commandName) {
	const cleanedCommandName = cleanInput(commandName);
	if (isUsingWindows) {
		return commandExistsWindowsSync(commandName, cleanedCommandName);
	}
	else {
		return commandExistsUnixSync(commandName, cleanedCommandName);
	}
}
