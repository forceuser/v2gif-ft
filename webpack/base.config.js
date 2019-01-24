/* global __dirname */
const webpack = require("webpack");
const path = require("path");
const pkg = require("../package.json");
const ma = pkg._moduleAliases || {};
const alias = Object.keys(ma).reduce((acc, key) => (acc[key] = path.resolve(__dirname, "../", ma[key])  , acc), {});



module.exports = (env = {}) => {
	function entry (name) {
		return [
			"@babel/polyfill",
			`./src/app/${name}.js`,
		];
	}

	return ({
		entry: ["index"].reduce((acc, name) => (acc[name] = entry(name), acc), {}),
		output: {
			path: path.resolve(__dirname, "../dist/js"),
			filename: "[name].js",
			publicPath: `/js/`,
			library: "[name]",
			libraryExport: "default",
			libraryTarget: "umd",
			// globalObject: "typeof self !== 'undefined' ? self : this",
		},
		resolve: {
			alias: alias,
		},
		devtool: "source-map",
		module: {
			rules: [
				{
					test: /\.(js|mjs)$/,
					exclude: /(node_modules)/,
					use: [{
						loader: "babel-loader",
						options: {
							babelrc: true,
							// envName: "browser",
						},
					}],
				},
				{
					test: /(\.html|\.txt)$/,
					use: [
						{
							loader: "raw-loader"
						}
					]
				},
			],
		},
		plugins: [
		],
	});
}
