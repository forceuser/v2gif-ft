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
					"app/static/assets/css/index.css": "app/static/assets/less/index.less"
				}
			}
		},
		autoprefixer: {
			options: {
				browsers: ["last 3 versions"],
				cascade: false
			},
			dist: {
				files: {
					"app/static/assets/css/index.css": "app/static/assets/css/index.css"
				}
			}
		},
		cssmin: {
			dist: {
				files: {
					"app/static/assets/css/index.min.css" : "app/static/assets/css/index.css"
				}
			}
		},
		watch: {
			less: {
				files: "app/static/assets/less/**/*.less",
				tasks: ["css"],
			},
		},
	});

	grunt.loadNpmTasks("grunt-shell");
	grunt.loadNpmTasks("grunt-autoprefixer");
	grunt.loadNpmTasks("grunt-contrib-cssmin");
	grunt.loadNpmTasks("grunt-contrib-less");
	grunt.loadNpmTasks("grunt-contrib-watch");

	grunt.registerTask("css", "build css", function () {
	   var tasks = [
		   "less",
		   "autoprefixer",
		   "cssmin"
	   ];
	   grunt.task.run(tasks);
	});

	grunt.registerTask("default", ["css", "shell:webpackClear", "shell:webpack"]);
	grunt.registerTask("less-watch", ["less", "watch:less"]);
};
