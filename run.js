require("module-alias/register");
require = require("esm")(module, {"cjs": true});
require("@babel/register");
require("@babel/polyfill");

module.exports = require("./app/server");
