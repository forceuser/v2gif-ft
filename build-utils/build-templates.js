#!/usr/bin/env node
/* global process */
import path from "path";
import fs from "fs-extra";
import globby from "globby";
import merge from "deepmerge";
import Mustache from "mustache";

const pkg = JSON.parse(fs.readFileSync("./package.json", "utf8"));

async function buildTemplates (params) {
	const paths = await globby("./templates/index.mustache", {cwd: "./src/"});
	paths.forEach(async fp => {
		console.log("BUILD TEMPLATE", fp);
		const pages = ["index", "404", "403", "other"];
		pages.forEach(async page => {
			await fs.ensureFile(path.resolve("./dist/", `${page}.html`));
			const extraParams = {};
			if (page !== "index") {
				extraParams.error = `"${page}"`;
			}
			await fs.writeFile(
				path.resolve("./dist/", `${page}.html`),
				Mustache.render(
					fs.readFileSync(path.resolve("./src/", fp), "utf8"),
					merge(params || {}, extraParams)
				)
			);
		});

	});
}


buildTemplates({
	version: pkg.version,
	timestamp: new Date(),
	package: pkg,
});
