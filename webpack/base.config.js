/* global __dirname */
import webpack from "webpack";
import path from "path";
import process from "process";
import {getJSON} from "../build-utils/common.js";

const pkg = getJSON("package.json");
const __dirname = path.dirname(new URL(import.meta.url).pathname);

const ma = pkg._moduleAliases || {};
const alias = Object.keys(ma).reduce((acc, key) => (acc[key] = ma[key].includes("/") ? path.resolve(__dirname, "../", ma[key]) : ma[key], acc), {});
const vasettings = pkg["va-release"] || {};

export default (env = {}) => {
	const copyEnv = JSON.parse(JSON.stringify(env))
	env = Object.assign(env, process.env, copyEnv);
	const config = {
		entry: {index: [
			`./src/app/index.js`
		]},
		output: {
			path: path.resolve(__dirname, "../dist/js"),
			filename: `index${env.WEBPACK_BUNDLE_SUFFIX || ""}.js`,
			library: vasettings.library,
			libraryExport: "default",
			libraryTarget: "umd",
			publicPath: `/resources/${pkg.version}/js/`,
			//globalObject: "typeof self !== 'undefined' ? self : this",
		},
		resolve: {
			alias,
		},
		devtool: "source-map",
		module: {
			rules: [
				...(vasettings.babel
					? [{
						test: /\.(js|mjs)$/,
						exclude: /(node_modules)/,
						use: [{
							loader: "babel-loader",
							options: {
								babelrc: true,
								envName: JSON.stringify(env),
							},
						}],
					}]
					: []),
				{
					test: /(\.html|\.txt)$/,
					use: [
						{
							loader: "raw-loader",
						},
					],
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
