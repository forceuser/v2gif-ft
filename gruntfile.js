module.exports = function (grunt) {
	grunt.initConfig({
		shell: {
			webpack: "webpack --config ./webpack/build.config.js && webpack --config ./webpack/build-min.config.js",
			webpackClear: "rm -rf ./dist",
		},
		less: {
			options: {
			},
			dist: {
				files: {
					"assets/css/index.css": "assets/less/index.less"
				}
			}
		},
		autoprefixer: {
			options: {
				browsers: ["last 50 versions"],
				cascade: false
			},
			dist: {
				files: {
					"assets/css/index.css": "assets/css/index.css"
				}
			}
		},
		cssmin: {
			dist: {
				files: {
					"assets/css/index.min.css" : "assets/css/index.css"
				}
			}
		},
		sync: {
			main: {
				files: [{
					cwd: "./",
					src: [
						"**",
						"!node_modules/**"
					],
					dest: "../../../../target/classes/static",
				},
				{
					cwd: "../templates",
					src: [
						"**"
					],
					dest: "../../../../target/classes/templates",
				},
				{
					cwd: "../i18n",
					src: [
						"**"
					],
					dest: "../../../../target/classes/i18n",
				}],
				verbose: true,
				updateAndDelete: true
			}
		}
	});

	grunt.loadNpmTasks("grunt-sync");
	grunt.loadNpmTasks("grunt-shell");
	grunt.loadNpmTasks("grunt-autoprefixer");
	grunt.loadNpmTasks("grunt-contrib-cssmin");
	grunt.loadNpmTasks("grunt-contrib-less");

	grunt.registerTask("css", "build css", function () {
	   var tasks = [
		   "less",
		   "autoprefixer",
		   "cssmin"
	   ];
	   grunt.task.run(tasks);
	});

	grunt.registerTask("default", ["css", "shell:webpackClear", "shell:webpack"]);
};
