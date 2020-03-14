/* global __dirname process */
import path from "path";
import merge from "webpack-merge";
import baseConfig from "./base.config.js";
import webpack from "webpack";

export default (env = {}) => {
	const base = baseConfig(env);
	const result = merge(base, {
		mode: "development",
		devServer: {},
	});
	Object.keys(result.entry).forEach(key => {
		result.entry[key] = [`webpack-hot-middleware/client?${base.name ? `name=${base.name}&` : ``}reload=true`].concat(result.entry[key]);
	});
	result.plugins.push(new webpack.HotModuleReplacementPlugin());
	return result;
};
