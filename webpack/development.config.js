/* global __dirname process */
const path = require("path");
const merge = require("webpack-merge");
const baseConfig = require("./base.config.js");
const webpack = require("webpack");

module.exports = merge(baseConfig, {
	mode: "development",
	devServer: {
		// index: "", // specify to enable root proxying
		host: `${process.env.CLIENT_HOST || "0.0.0.0"}`,
		port: `${process.env.CLIENT_PORT || "80"}`,
		publicPath: "/dist/",
		proxy: {"**": `http://${process.env.SERVER_HOST || "0.0.0.0"}:${process.env.SERVER_PORT || "3000"}`},
	},
});
// module.exports.entry.index = [module.exports.entry.index, "webpack-hot-middleware/client"];
module.exports.plugins = module.exports.plugins.map(i => i);
// module.exports.plugins.push(new webpack.HotModuleReplacementPlugin());
