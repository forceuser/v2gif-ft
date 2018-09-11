/* global __dirname */
const path = require("path");

module.exports = ({
	entry: {
		"index": path.resolve(__dirname, "../app/index.js"),
	},
	output: {
		path: path.resolve(__dirname, "../app/static/js"),
		filename: "[name].js",
		publicPath: "/js/",
	},
	devtool: "source-map",
	module: {
		rules: [{
			test: /\.(js|mjs)$/,
			exclude: /(node_modules)/,
			use: [{
				loader: "babel-loader",
				options: {
					babelrc: true,
					envName: "browser",
				},
			}],
		}],
	},
	plugins: [
	],
});
