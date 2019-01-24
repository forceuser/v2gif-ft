const ENVIRONMENT_IS_REACT_NATIVE = typeof navigator === "object" && navigator.product === "ReactNative";
const ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function";
const ENVIRONMENT_IS_WEB = typeof window === "object";
const ENVIRONMENT_IS_WORKER = typeof importScripts === "function";

const tryEx = (fn) => {
	try {return fn();}
	catch (error) {return undefined;}
};

function serializeRequest (request) {
	const headers = {};
	for (const entry of request.headers.entries()) {
		headers[entry[0]] = entry[1];
	}
	const serialized = {
		url: request.url,
		headers,
		method: request.method,
		mode: request.mode,
		credentials: request.credentials,
		cache: request.cache,
		redirect: request.redirect,
		referrer: request.referrer,
	};

	if (request.method !== "GET" && request.method !== "HEAD") {
		return request.clone().text().then((body) => {
			serialized.body = body;
			return Promise.resolve(serialized);
		});
	}
	return Promise.resolve(serialized);
}

function deserializeRequest (data) {
	const url = data.url;
	delete data.url;
	return Promise.resolve(new Request(url, data));
}

function attach (env, onSuccess, onError) {
	// Make sure fetch is avaibale in the given environment
	function fin (fetch) {
		env.fetch = (function wrapper (fetch) {
			return function fetchWithInterceptor (...args) {
				return interceptor(fetch, ...args);
			};
		})(fetch);
		onSuccess && onSuccess();
	}

	if (!env.fetch) {
		try {
			import("isomorphic-fetch").then(module => fin(module.default));
		}
		catch (error) {
			onError && onError(error);
			throw new Error("No fetch avaibale. Unable to register fetch-intercept");
		}
	}
	else {
		fin(env.fetch);
	}
}

let interceptors = [];

function interceptor (fetch, ...args) {
	const reversedInterceptors = interceptors.reduce((array, interceptor) => [interceptor].concat(array), []);
	let url;
	let request;
	if (args[0] instanceof Request) {
		request = serializeRequest(args[0]);
		url = request.url;
	}
	else {
		request = args[1] || {};
		url = args[0];
		request.url = url;
	}

	let promise = Promise.resolve(request);
	// Register request interceptors
	reversedInterceptors.forEach(interceporConfig => {
		if (interceporConfig.request) {
			promise = promise.then(request => interceporConfig.request(request));
		}
		if (interceporConfig.requestError) {
			promise = promise.catch(err => interceporConfig.requestError(err));
		}
	});

	// Register fetch call
	let storedRequest;
	promise = promise.then(request => {
		storedRequest = request;
		return fetch(url, request);
	});

	// Register response interceptors
	reversedInterceptors.forEach(interceporConfig => {
		if (interceporConfig.response) {
			promise = promise.then(response => interceporConfig.response(response, storedRequest));
		}
		if (interceporConfig.responseError) {
			promise = promise.catch(error => interceporConfig.responseError(error, storedRequest));
		}
	});

	return promise;
}

export default {
	serializeRequest,
	deserializeRequest,
	register (interceptor) {
		interceptors.push(interceptor);
		return () => {
			const index = interceptors.indexOf(interceptor);
			if (index >= 0) {
				interceptors.splice(index, 1);
			}
		};
	},
	clear () {
		interceptors = [];
	},
};

export function initFetch () {
	return new Promise((resolve, reject) => {
		attach(tryEx(() => self) || tryEx(() => window) || tryEx(() => global), resolve, reject);
	});
}
