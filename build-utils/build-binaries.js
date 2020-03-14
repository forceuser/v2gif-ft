import {exec} from "./common.js";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import unzipper from "unzipper";

const __dirname = path.dirname(new URL(import.meta.url).pathname);

async function main () {
	if (!fs.pathExistsSync(path.resolve(__dirname, "./sources/gifsicle-1.92"))) {
		await fetch("https://github.com/kohler/gifsicle/archive/v1.92.zip", {
			method: "get",
		})
			.then(async response => {
				// await fs.ensureDir(path.resolve(__dirname, "./sources/"));
				return new Promise((resolve, reject) => {
					response.body
						.pipe(unzipper.Extract({path: path.resolve(__dirname, "./sources/")}))
						.on("error", reject);
					response.body.on("end", () => resolve("it worked"));
				});
			});
	}
	await exec(`cd ${path.resolve(__dirname, "./sources/gifsicle-1.92")} && autoreconf -ivf && ./configure --disable-gifview --disable-gifdiff --prefix="${path.resolve(__dirname, "./bin/")}"  --bindir="${path.resolve(__dirname, "./bin/")}" && make install`);


}

main();
