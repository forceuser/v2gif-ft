/* global __dirname */
const path = require("path");

module.exports = ({
	entry: {
		"index": path.resolve(__dirname, "../app/index.mjs"),
	},
	output: {
		path: path.resolve(__dirname, "../dist"),
		filename: "[name].js",		
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
				},
			}],
		}],
	},
	plugins: [
	],
});
