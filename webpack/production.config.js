/* global __dirname */
const path = require("path");
const merge = require("webpack-merge");
const baseConfig = require("./base.config.js");

module.exports = merge(baseConfig, {
    mode: "production",
});
