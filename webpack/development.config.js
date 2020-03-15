const path = require("path");
const process = require("process");
const merge = require("webpack-merge");
const baseConfig = require("./base.config.js");
const webpack = require("webpack");

module.exports = (env = {}) => {
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
