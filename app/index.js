import {default as fetchInterceptors, initFetch} from "./fetch-interceptors";
import isMobile from "ismobilejs";
import $ from "jquery";

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
	let files = [];
	const $form = $("form");
	const updateState = () => {
		$form.find(`.file-list`).html(files.map((file, idx) => `
			<li>${file.name} [<a href="#" class="id--remove-file" idx="${idx}">удалить</a>]</li>
		`).join(""));
		$form.find(`button[type="submit"]`).prop("disabled", !files.length);
	};
	$form.on("click", ".id--remove-file", event => {
		files.splice(+$(event.currentTarget).attr("idx"), 1);
		updateState();
	})
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
		const form = $(`<form id="file-form" style="z-index: -1; position: absolute; width: 0; height: 0; overflow: hidden; opacity: 0;"><input type="file" multiple/></form>`).appendTo("body");
		const input = form.find("input");
		input.on("change", event => {
			files = [...files, ...input[0].files];
			updateState();
			form.remove();
		});
		input.click();
	});


	$form.on("submit", async event => {
		event.preventDefault();
		const body = new FormData();
		files.forEach(file => body.append("file", file));
		const result = await fetch(`/post`, {
			method: "POST",
			body,
		})
			.then(response => response.json());

		console.log("RESULT", result);
	});
}

Promise.all([
	// pre init
	initFetch(),
]).then(async () => {
	console.log("Fetch initialized");
	main();
});
