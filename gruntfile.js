module.exports = function (grunt) {
	grunt.initConfig({
		less: {
			options: {
			},
			dist: {
				files: {
					"app/static/css/index.css": "app/assets/less/index.less"
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
					"app/static/css/index.css": "app/static/css/index.css"
				}
			}
		},
		cssmin: {
			dist: {
				files: {
					"app/static/css/index.min.css" : "app/static/css/index.css"
				}
			}
		},
		watch: {
			less: {
				files: "app/assets/less/**/*.less",
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

	grunt.registerTask("default", ["css"]);
	grunt.registerTask("less-watch", ["css", "watch:less"]);
};
