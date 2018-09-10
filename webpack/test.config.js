/* global __dirname */
const path = require("path");
const merge = require("webpack-merge");
const devConfig = require("./development.config.js");

module.exports = merge(devConfig, {
	entry: [
		path.resolve(__dirname, "../test/test-runner.js")
	],
	output: {
		path: path.resolve(__dirname, "../test/build"),
		filename: "test-runner-node.js",
		devtoolModuleFilenameTemplate: '[absolute-resource-path]',
	},	
	target: "node",
	resolve: {
		alias: {
			"src": path.resolve(__dirname, "../src")
		}
	},
	devtool: "source-map",
});
