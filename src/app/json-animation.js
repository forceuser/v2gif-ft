import bodymovin from "bodymovin";
import $ from "jquery";

export default function animateJSON (container, animationData, loop = false, onComplete) {
	const $container = $(container).eq(0);
	if ($container[0]) {
		$container.empty();
		const anim = bodymovin.loadAnimation({
			container: $container[0],
			renderer: "svg",
			loop: loop,
			autoplay: false,
			animationData,
			rendererSettings: {
				preserveAspectRatio: "xMidYMid slice",
			},
		});
		onComplete && anim.addEventListener("complete", onComplete);
		return anim;
	}
}
