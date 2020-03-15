import isMobile from "ismobilejs";
import $ from "cash-dom";
import filesize from "filesize";

function updateDeviceType () {
	const deviceType = isMobile.tablet
		? "tablet"
		: isMobile.phone
			? "mobile"
			: "desktop";
	$("body").attr("device-type", deviceType);
	if (deviceType === "desktop") {
		$(".view-shadow").addClass("active");
	}
}

updateDeviceType();

function main () {
	const url = new URL(window.location.href);


	let files = [];
	const $form = $("form.page-upload");
	const updateState = () => {
		$form.find(`.file-list`).html(
			files
				.map((file, idx) => `<li>${file.name} (${filesize(file.size, {locale: "ru"})}) [<a href="#" class="id--remove-file" idx="${idx}">удалить</a>]</li>`)
				.join("")
		);
		$form.find(`button[type="submit"]`).prop("disabled", !files.length);
	};
	$form.on("click", ".id--remove-file", event => {
		files.splice(+$(event.currentTarget).attr("idx"), 1);
		updateState();
	});
	$form
		.on(
			"drag dragstart dragend dragover dragenter dragleave drop",
			event => {
				event.preventDefault();
				event.stopPropagation();
			}
		)
		.on("dragover dragenter", () => {
			$form.addClass("is-dragover");
		})
		.on("dragleave dragend drop", () => {
			$form.removeClass("is-dragover");
		})
		.on("drop", event => {
			files = [...files, ...event.originalEvent.dataTransfer.files];
			updateState();
		});

	$form.find(".id--add-files").on("click", () => {
		$(`#file-form`).remove();
		const form = $(
			`<form id="file-form" style="z-index: -1; position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0;"><input type="file" accept="video/mp4,video/x-m4v,video/*" multiple/></form>`
		).appendTo("body");
		const input = form.find("input");
		input.on("change", event => {
			files = [...files, ...input[0].files];
			updateState();
			form.remove();
		});
		input[0]?.click();
	});

	$(".page-result").on("submit", async event => {
		files = [];
		updateState();
		$(".page-upload").addClass("active");
		$(".page-result").removeClass("active");
	});

	async function resultScreen (taskId) {
		$(".page-loader").addClass("active");
		let resolved = false;
		let result;
		function fail () {
			const newurl = new URL(window.location);
			newurl.searchParams.delete("task");
			window.location.href = newurl.toString();
		}
		while (!resolved) {
			try {
				result = await fetch(`/task/${taskId}`).then(response => response.json());
			}
			catch (error) {
				return fail();
			}

			resolved = result.resolved;
			if (!resolved) {
				await new Promise(resolve => setTimeout(resolve, 3000));
			}
		}
		result = result.result;
		$(".page-result").addClass("active");
		$(".page-upload").removeClass("active");
		$(".page-loader").removeClass("active");
		console.log("TASK", result);
		const list = $(".result-list");
		list.html(
			(result.results || []).map(
				i => `
					<div class="result-item">
						<img style="max-width: 90%;" src="/file/${i.id}.gif" />
						<div style="margin-top: 20px;">
							<a href="/file/${i.id}.gif" target="_blank" download="${i.original}.gif">скачать gif (${filesize(i.size.gif, {locale: "ru"})})</a>
						</div>
					</div>
					<div class="result-item">
						<video style="max-width: 90%; width: 230px;" playsinline loop autoplay muted disableremoteplayback src="/file/${i.id}.mp4">
						</video>
						<div style="margin-top: 20px;">
							<a href="/file/${i.id}.mp4" target="_blank" download="${i.original}.mp4">скачать mp4 (${filesize(i.size.mp4, {locale: "ru"})})</a>
						</div>
					</div>
				`
			)
		);
	}

	$form.on("submit", async event => {
		event.preventDefault();
		const body = new FormData();
		files.forEach(file => body.append("file", file));
		$(".page-loader").addClass("active");
		const params = {
			compression: 30,
			dither: "sierra2_4a:diff_mode=rectangle",
			scaleWidth: 230,
			fps: 7,
			// dither: "bayer:bayer_scale=5"
		};

		const result = await fetch(`/task?${Object.keys(params).map(key => `${key}=${params[key]}`).join("&")}`, { // &dither=sierra2
			method: "POST",
			body,
		})
			.then(response => response.json());
		const newurl = new URL(window.location);
		newurl.searchParams.set("task", result.id);
		history.pushState({}, document.title, newurl.toString());
		resultScreen(result.id);
	});
	console.log(`url.searchParams.get("task")`, url.searchParams.get("task"));
	if (url.searchParams.get("task")) {

		resultScreen(url.searchParams.get("task"));
	}
}

export default main;
