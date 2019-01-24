import path from "path";
import fs from "fs-extra";
import yargs from "yargs";
import "isomorphic-fetch";
import {URL} from "universal-url";
import open from "./opn";
import "colors";
// import SocksProxyAgent from "socks-proxy-agent";
// const proxyAgent = new SocksProxyAgent("socks://127.0.0.1:9050", true);
const argv = yargs
	.alias("from", "f")
	.alias("to", "t")
	.help()
	.argv;

const __dirname = path.dirname(new URL(import.meta.url).pathname);
async function getJSON (uri, def) {
	try {
		return JSON.parse(await fs.readFile(path.resolve(__dirname, uri), "utf8"));
	}
	catch (error) {
		return def || {};
	}
}

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

function set (src, path, value) {
	const p = path.replace(/["']/g, "").replace(/\[/g, ".").replace(/\]/g, "").split(".");
	let c = src;
	if (p[0]) {
		for (let i = 0; i < p.length; i++) {
			if (i !== p.length - 1 && typeof c[p[i]] !== "object") {
				c[p[i]] = {};
			}
			if (i === p.length - 1) {
				c[p[i]] = value;
			}
			else {
				c = c[p[i]];
			}
		}
	}
	return src;
}

async function trans (text, {from, to}) {
	try {
		// console.log("text", text);
		const json = (await (fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&ie=UTF-8&oe=UTF-8&&q=${encodeURI(text)}`, {
			// agent: proxyAgent,
		}).then(res => res.json())));
		// console.log("json", json);
		return json[0].reduce((acc, val) => (acc += val[0], acc), "");
	}
	catch (error) {
		console.log("Error", error);
	}
	return "[error]";
}

async function translateBatch (batchArr, from, to, prevData, diff = {}, startFrom = 0) {
	let batchStr = "";
	let i = startFrom;
	while (i < batchArr.length) {
		const s = "~" + batchArr[i].val + "\n";
		if ((batchStr + s).length > 2000) {
			break;
		}
		batchStr += s;
		i++;
	}
	// console.log(batchStr);
	const resultStr = await trans(batchStr, {from, to});
	// console.log(resultStr);
	await timeout(10000).promise;
	// const resultStr = batchStr;
	resultStr.split("\n").forEach((str, idx) => {
		const item = batchArr[startFrom + idx];
		item.val = str.replace(/^\s*[~]*\s*/, "").replace(/\$\s+\{/g, "${");
		restoreAfterBatch(item);
		console.log("-", item.path);
		console.log(item.original.red, "->", item.val.green);
		diff[item.path] = diff[item.path] || {};
		diff[item.path][from] = item.original;
		diff[item.path][to] = item.val;
		const prev = get(prevData, item.path);
		if (prev != null) {
			diff[item.path][`${to}#`] = prev;
		}
		item && item.cb(item.val);
	});
	if (i < batchArr.length) {
		await translateBatch(batchArr, from, to, prevData, diff, i);
	}
	return diff;
}


const getPath = (path, key) => path ? `${path}.${key}` : key;


function restoreAfterBatch (item) {
	item.val = item.val.replace(/__\s*?(\d+)\s*?__/igm, (all, g1, idx) => {
		// console.log("restoreAfterBatch", g1, item.repl[g1]);
		return item.repl[g1];
	});
	// console.log("after restoration", item.val);
	return item;
}

function prepareToBatch (item) {
	item.repl = {};
	item.original = item.val;
	let i = 0;
	item.val = item.val.replace(/\<[\/]?[a-z]+[^<>]*?\>/igm, (all, idx) => {
		i++;
		item.repl[i] = all;
		return `__${i}__`;
	});
	// console.log(item.val, item.repl);

	return (item);
}

function translateDeep (fromData, fromDataPrev, result = {}, path = "", batchArr = []) {
	Object.keys(fromData).forEach((key) => {
		const val = fromData[key];
		if (typeof val === "string" || typeof val === "number") {
			const p = getPath(path, key);
			if (!result[key] || (typeof result[key] !== "string" && typeof result[key] !== "number") || get(fromDataPrev, p) !== val) {
				batchArr.push(prepareToBatch({val, cb: text => result[key] = text, path: p}));
			}
		}
		else if (Array.isArray(val)) {
			result[key] = Array.isArray(result[key]) ? result[key] : [];
			translateDeep(val, fromDataPrev, result[key], getPath(path, key), batchArr);
		}
		else {
			result[key] = !Array.isArray(result[key]) ? result[key] || {} : {};
			translateDeep(val, fromDataPrev, result[key], getPath(path, key), batchArr);
		}
	});
	return {result, batchArr};
}

const diff = {};
async function run (from, to, fromData, fromDataPrev) {
	let existingData;
	let prevData;
	try {
		existingData = await getJSON(`../src/app/nls/${to}/main.json`);
	}
	catch (error) {
		console.log(`Creating new translationfile for ${to}`);
	}
	try {
		prevData = await getJSON(`./translate/${to}.json`);
	}
	catch (error) {/* */}
	const {result, batchArr} = translateDeep(fromData, fromDataPrev, existingData);

	await translateBatch(batchArr, from, to, prevData, diff);
	return result;
}

async function applyDiff (lang, data, diff) {
	Object.keys(diff).forEach(path => {
		if (diff[path][lang] != null) {
			set(data, path, diff[path][lang]);
		}
	});
	await fs.ensureFile(path.resolve(__dirname, `../src/app/nls/${lang}/main.json`));
	await fs.writeFile(path.resolve(__dirname, `../src/app/nls/${lang}/main.json`), JSON.stringify(data, null, "\t"), "utf8");
	await fs.ensureFile(path.resolve(__dirname, `./translate/${lang}.json`));
	await fs.writeFile(path.resolve(__dirname, `./translate/${lang}.json`), JSON.stringify(data, null, "\t"), "utf8");
}

function timeout (time) {
	let cancel;
	const promise = new Promise((resolve, reject) => {
		setTimeout(() => resolve(), time);
		cancel = reject;
	});
	return {
		promise,
		cancel,
	};
}


(async () => {
	const ruData = await getJSON(`../src/app/nls/ru/main.json`);
	const ruDataPrev = await getJSON(`./translate/ru.json`, ruData);
	const ukData = await run("ru", "uk", ruData, ruDataPrev);
	const enData = await run("ru", "en", ruData, ruDataPrev);
	await fs.ensureFile(path.resolve(__dirname, `./translate/diff.json`));
	await fs.writeFile(path.resolve(__dirname, `./translate/diff.json`), JSON.stringify(diff, null, "\t"), "utf8");
	await open(path.resolve(__dirname, `./translate/diff.json`), {wait: true, bash: true, app: "nano"});
	const resDiff = await getJSON(path.resolve(__dirname, `./translate/diff.json`));
	await applyDiff("ru", ruData, resDiff);
	await applyDiff("uk", ukData, resDiff);
	await applyDiff("en", enData, resDiff);
	console.log("====================");
	console.log("Translation is done!".green, "😎");
})();

