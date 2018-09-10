/* global __dirname */
const path = require("path");
const merge = require("webpack-merge");
const baseConfig = require("./base.config.js");
const webpack = require("webpack");

module.exports = merge(baseConfig, {
    mode: "development"
});
module.exports.entry.index = [module.exports.entry.index, "webpack-hot-middleware/client"];
module.exports.plugins = module.exports.plugins.map(i => i);
module.exports.plugins.push(new webpack.HotModuleReplacementPlugin());
console.log(module.exports);
