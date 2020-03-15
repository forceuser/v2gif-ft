const webpack = require("webpack");
const path = require("path");
const process = require("process");

module.exports = (env = {}) => {
	const copyEnv = JSON.parse(JSON.stringify(env))
	env = Object.assign(env, process.env, copyEnv);
	const config = {
		entry: {index: [
			`./src/app/index.js`
		]},
		output: {
			path: path.resolve(__dirname, "../dist/js"),
			filename: "index.js",
			publicPath: `/js/`,
			library: "v2gif",
			libraryExport: "default",
			libraryTarget: "umd",
			//globalObject: "typeof self !== 'undefined' ? self : this",
		},
		resolve: {
		},
		devtool: "source-map",
		module: {
			rules: [
				{
					test: /\.(js|mjs|cjs)$/,
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
			new webpack.DefinePlugin({
				"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
			}),
		],
	};
	if (env.BROWSERSLIST_ENV) {
		config.name = env.BROWSERSLIST_ENV;
	}

	return config;
};
