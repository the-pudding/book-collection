<script>
	import { getContext } from "svelte";
	import canTab from "$actions/canTab.js";
	const { dir, cur, w, h, count } = getContext("Slider");

	let { index } = $props();

	const width = $derived($dir === "horizontal" ? `${$w}px` : "100%");
	const height = $derived($dir === "vertical" ? `${$h}px` : "100%");
	const visible = $derived(index === $cur);
	const disable = $derived(!visible);
</script>

<div
	id="slide-{index}"
	class="slide"
	class:visible
	style:width
	style:height
	role="group"
	aria-label="slide {index + 1} of {$count}"
	aria-current={visible}
	use:canTab={{ disable }}
>
	<slot />
</div>

<style>
	.slide {
		position: relative;
		width: 100%;
		height: 100%;
	}
</style>
