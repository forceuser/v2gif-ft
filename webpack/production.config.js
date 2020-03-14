/* global __dirname */
import path from "path";
import merge from "webpack-merge";
import baseConfig from "./base.config.js";
import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";

export default (env = {}) => {
	const result = merge(baseConfig(env), {
		mode: "production",
		optimization: {
			minimizer: [
				new TerserPlugin({
					sourceMap: true,
				}),
			],
		},
	});
	// result.plugins.push(new webpack.optimize.MinChunkSizePlugin({minChunkSize: 100000}));

	return result;
};
