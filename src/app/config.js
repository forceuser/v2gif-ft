export default class Config {
	constructor (settings = {}) {
		this.data = {};
		const defaultSettings = {
			delimiter: "-",
			format: "lowercase",
			alias: {},
		};
		settings = Object.assign({}, defaultSettings, settings);

		const transformKey = key => {
			const parts = key.toLowerCase().split(/[A-Z-_]/g);
			parts.map(part => {
				switch (settings.format) {
					case "lowercase": {
						return part.toLowerCase();
					}
					case "uppercase": {
						return part.toUpperCase();
					}
					case "capitalize": {
						return part.substr(0, 1).toLowerCase() + part.substr(1);
					}
				}
			});

			const result = parts.join(settings.delimiter);
			return result;
		};

		settings.configs = settings.configs || [];
		// console.log("settings.configs", settings.configs);
		settings.configs.forEach(configItem => {
			const {type, data = {}} = configItem;
			Object.keys(data).forEach(key => {
				if (!key) {
					return;
				}
				const $key = transformKey(key);
				if (type === "argv" && ["$0", "_"].includes(key)) {
					return;
				}
				if (type === "env" && settings.env && !settings.env.includes($key)) {
					return;
				}
				let value = data[key];
				if (type === "env" && (value || "").toString().toLowerCase() === "true") {
					value = true;
				}
				if (type === "env" && (value || "").toString().toLowerCase() === "false") {
					value = false;
				}
				this.data[$key] = value;
				if (settings.alias[$key]) {
					this.data[settings.alias[$key]] = value;
				}
			});
		});

	}
	get (...args) {
		const [path, defaultValue] = args;
		const src = this.data;
		const getValue = () => {
			if (src == null) {
				return undefined;
			}
			const p = path.replace(/["']/g, "").replace(/\[/g, ".").replace(/\]/g, "").split(".");
			let c = src;
			if (p[0]) {
				for (let i = 0; i < p.length; i++) {
					if (i === p.length - 1) {
						return c[p[i]];
					}
					c = c[p[i]];
					if (c == null || typeof c !== "object") {
						return undefined;
					}
				}
			}
			return c;
		};
		const result = getValue();
		return result == null && args.length > 1 ? defaultValue : result;
	}
	set (path, value) {
		const src = this.data;
		const p = path.replace(/["']/g, "").replace(/\[/g, ".").replace(/\]/g, "").split(".");
		let c = src;
		if (p[0]) {
			for (let i = 0; i < p.length; i++) {
				if (i !== p.length - 1 && typeof c[p[i]] !== "object") {
					c[p[i]] = {};
				}
				if (i === p.length - 1) {
					c[p[i]] = value;
				}
				else {
					c = c[p[i]];
				}
			}
		}
		return src;
	}
}
