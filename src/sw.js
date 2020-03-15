/* global clients */

// const baseUrl = self.scriptURL.replace(/\/[^\/]*?$/igm, "/");
const baseUrl = location.origin.replace(/\/$/, "") + "/";

function escapeRegExp (s) {
	return s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
}

class Deferred {
	constructor () {
		this.promise = new Promise((resolve, reject) => {
			this.ctrl = {resolve, reject};
		});
	}
	resolve () {
		return this.ctrl.resolve();
	}
	reject () {
		return this.ctrl.reject();
	}
}

const cacheName = "static";

self.addEventListener("install", event => {
	console.log("sw install", event);
});

self.addEventListener("activate", event => {
	console.log("sw activate", event);

});

self.addEventListener("message", event => {
	console.log("sw message", event);
});

function isAbsoluteURL (string) {
	return /^([a-z]+:\/\/|\/\/)/i.test(string);
}

function isRangeRequest (request) {
	return request.headers.get("range");
}

async function createRangeResponse (request, response) {
	const data = await response.arrayBuffer();
	const bytes = /^bytes\=(\d+)\-(\d+)?$/g.exec(request.headers.get("range"));
	if (bytes) {
		const start = Number(bytes[1]);
		const end = Number(bytes[2]) || data.byteLength - 1;
		return new Response(data.slice(start, end + 1), {
			status: 206,
			statusText: "Partial Content",
			headers: [
				["Content-Range", `bytes ${start}-${end}/${data.byteLength}`],
			],
		});
	}
	else {
		return new Response(null, {
			status: 416,
			statusText: "Range Not Satisfiable",
			headers: [
				["Content-Range", `*/${data.byteLength}`],
			],
		});
	}
}

self.addEventListener("fetch", event => {
	// console.log("sw fetch", event.request.url);
	event.respondWith((async () => {
		const request = event.request;
		const url = request.url;
		const contentType = request.headers.get("Content-Type");
		const relUrl = (url.replace(new RegExp("^" + escapeRegExp(baseUrl), "igm"), "") || "").split("#")[0].split("?")[0];
		const isAbsolute = isAbsoluteURL(relUrl);
		const isCacheable = url.includes(`fonts.gstatic.com`) || (!isAbsolute && !relUrl.match(/^(api|browsersymc)\//)); // contentType.includes("text/html") || (["css/", "img/", "js/"].some(match => relUrl.startsWith(match)) &&
		// console.log("relUrl", url, relUrl, isCacheable, isIndexHtml);
		if (isCacheable) {
			const cache = await caches.open(cacheName);
			try {
				const response = await fetch(request);
				if (response.ok && request.method === "GET") {
					cache.put(request, response.clone());
				}
				if (isRangeRequest(request)) {
					return createRangeResponse(request, response);
				}
				return response;
			}
			catch (error) {
				//
			}
			const cachedResponse = await cache.match(request);
			if (cachedResponse) {
				if (isRangeRequest(request)) {
					return createRangeResponse(request, cachedResponse);
				}
				return cachedResponse;
			}
		}
		else {
			return fetch(request).catch(error => {
				console.log("SW fetch error", error);
				const body = new Blob([JSON.stringify({online: false})], {type: "application/json"});
				return new Response(body, {
					status: 400,
					statusText: "network_error",
				});
			});
		}

	})());
});
