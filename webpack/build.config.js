/* global __dirname */
const path = require("path");
const webpack = require("webpack");

const entries = [
	"./polyfill/polyfill.js",
	"regenerator-runtime/runtime",
	"./app/index.js",
];

module.exports = [
	{
		entry: entries,
		output: {
			path: path.resolve(__dirname, "../dist"),
			filename: "index.js",
			chunkFilename: "[id]-index.js",
			publicPath: `resources/${(+new Date())}/dist/`
		},
		resolve: {
			alias: {
				app: path.resolve(__dirname, "../app")
			}
		},
		devtool: "source-map",
		module: {
			rules: [
				{
					test: /\.(js|mjs)$/,
					exclude: /(node_modules)/,
					use: [{loader: "babel-loader"}]
				},
				{
					test: /(\.html|\.txt)$/,
					use: [{loader: "raw-loader"}]
				},
			]
		},
		plugins: [
			new webpack.ProvidePlugin({
				$: "jquery",
				jQuery: "jquery",
				"window.jQuery": "jquery"
			})
			// new webpack.optimize.MinChunkSizePlugin({minChunkSize: 1000000}),
		]
	},
]
