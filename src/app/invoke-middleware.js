function flattenDeep (array, parent = []) {
	return array.reduce((parent, item) => {
		if (Array.isArray(item)) {
			flattenDeep(item, parent);
		}
		else {
			parent.push(item);
		}
		return parent;
	}, parent);
}

function invokeHandler (handler, handlerArgs) {
	return new Promise((resolve, reject) => {
		const next = (rejectValue, resolveValue) => {
			if (rejectValue) {
				reject(rejectValue);
			}
			else {
				resolve(resolveValue);
			}
		};
		handler.call(null, ...handlerArgs, next);
	});
}

export default function invokeMiddleware (middlewares, request, response) {
	const flatList = flattenDeep([middlewares]);

	return flatList
		.reduce(
			(chain, handler) => {
				if (handler.length === 4) { // 4 arguments notation (error handler)
					return chain.catch(error => invokeHandler(handler, [error, request, response]));
				}
				else if (handler.length === 3) { // 3 arguments
					return chain.then(() => invokeHandler(handler, [request, response]));
				}
				return chain;
			},
			Promise.resolve(),
		);
}
