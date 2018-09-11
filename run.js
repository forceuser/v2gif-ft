/* global process */

const watchr = require("watchr");
const pirates = require("pirates");

// pirates.addHook(
// 	(code, filename) => {
// 		if (
// 			filename &&
// 			filename.startsWith("/") &&
// 			!filename.includes("/node_modules/")
// 		) {
// 			// console.log("ADD FILE TO WATCH", filename);
// 			const stalker = watchr.create(filename);
// 			stalker.setConfig({
// 				interval: 1500,
// 				catchupDelay: 2000,
// 				persistent: false,
// 			});
// 			stalker.on(
// 				"change",
// 				(changeType, fullPath, currentStat, previousStat) => {
// 					console.log("FILE CHANGED", fullPath);
// 					restart();
// 				}
// 			);
// 			stalker.once("close", (reason) => {
// 				stalker.removeAllListeners();
// 			});
// 			stalker.watch(() => {});
// 		}
// 		return code;
// 	},
// 	{exts: [".js", ".mjs", ".json"]}
// );

// function restart () {
// 	console.log("restarting node server");
// 	process.on("exit", () => {
// 		require("child_process").spawn(process.argv.shift(), process.argv, {
// 			cwd: process.cwd(),
// 			detached: true,
// 			stdio: "inherit",
// 		});
// 	});
// 	process.exit();
// }

require("module-alias/register");
require = require("esm")(module, {cjs: true});
require("@babel/register");
require("@babel/polyfill");

module.exports = require("./app/server");
