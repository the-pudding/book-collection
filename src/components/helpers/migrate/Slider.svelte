<!--
Add the css snippet below to your global css file to do a 
full-screen + mobile friendly slider
	
html, body, main {
	height: 100%;
	overflow: hidden;
}

Usage:
<script>
	import Slider from "$components/helpers/Slider.svelte";
	import Slide from "$components/helpers/Slider.Slide.svelte";

	let sliderEl; // component binding

	sliderEl.next(); // navigation call
</script>

<Slider bind:this={sliderEl}>
	<Slide>
		<p>content</p>
	</Slide>
</Slider>
-->
<script>
	import { setContext, onMount } from "svelte";
	import { writable } from "svelte/store";

	let {
		direction = "horizontal",
		duration = "500ms",
		timing = "ease"
	} = $props();

	let count = $state(0);
	let current = $state(0);

	const next = () => move(1);
	const prev = () => move(-1);
	const jump = (val) => move(val, true);

	let children = $state(0);
	let index = $state(0);
	let width = $state(0);
	let height = $state(0);
	let isInView = $state(false);
	let sliderEl;
	let translateEl;
	let observer;
	
	// Touch/swipe handling
	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let touchCurrentX = $state(0);
	let touchCurrentY = $state(0);
	let isDragging = $state(false);
	let dragOffset = $state(0);

	const move = (val, jump) => {
		if (!isInView) return false;
		const target = jump ? val : index + val;
		index = Math.max(0, Math.min(children - 1, target));
		current = index;
		dragOffset = 0;
	};
	
	// Touch/swipe handlers
	const handleStart = (e) => {
		const touch = e.touches?.[0] || e;
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		touchCurrentX = touch.clientX;
		touchCurrentY = touch.clientY;
		isDragging = true;
		dragOffset = 0;
	};
	
	const handleMove = (e) => {
		if (!isDragging) return;
		e.preventDefault();
		const touch = e.touches?.[0] || e;
		touchCurrentX = touch.clientX;
		touchCurrentY = touch.clientY;
		
		if (direction === "horizontal") {
			const deltaX = touchCurrentX - touchStartX;
			const maxOffset = width * 0.3; // Allow 30% drag
			dragOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX));
		} else {
			const deltaY = touchCurrentY - touchStartY;
			const maxOffset = height * 0.3;
			dragOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaY));
		}
	};
	
	const handleEnd = () => {
		if (!isDragging) return;
		isDragging = false;
		
		const threshold = direction === "horizontal" ? width * 0.2 : height * 0.2;
		
		if (Math.abs(dragOffset) > threshold) {
			if (dragOffset > 0 && index > 0) {
				prev();
			} else if (dragOffset < 0 && index < children - 1) {
				next();
			} else {
				dragOffset = 0;
			}
		} else {
			dragOffset = 0;
		}
	};

	const onIntersect = (e) => {
		isInView = e[0].isIntersecting;
	};

	const w = $derived(direction === "horizontal" ? `${children * width}px` : "100%");
	const h = $derived(direction === "vertical" ? `${children * height}px` : "100%");

	const baseX = $derived(index * width * -1);
	const baseY = $derived(index * height * -1);
	const x = $derived(direction === "horizontal" ? `${baseX + dragOffset}px` : 0);
	const y = $derived(direction === "vertical" ? `${baseY + dragOffset}px` : 0);

	const sW = $derived(`width: ${w};`);
	const sH = $derived(`height: ${h};`);
	const sT = $derived(`transform: translate3d(${x}, ${y}, 0);`);
	const sTD = $derived(isDragging ? `transition-duration: 0ms;` : `transition-duration: ${duration};`);
	const sTTF = $derived(`transition-timing-function: ${timing};`);
	const customStyle = $derived(`${sW} ${sH} ${sT} ${sTD} ${sTTF}`);

	// context - use stores for compatibility with Slide component
	const dirStore = writable(direction);
	const curStore = writable(0);
	const wStore = writable(0);
	const hStore = writable(0);
	const countStore = writable(0);
	
	// Update stores when state changes
	$effect(() => {
		dirStore.set(direction);
	});
	$effect(() => {
		curStore.set(current);
	});
	$effect(() => {
		wStore.set(width);
	});
	$effect(() => {
		hStore.set(height);
	});
	$effect(() => {
		countStore.set(count);
	});
	
	const context = {
		dir: dirStore,
		cur: curStore,
		w: wStore,
		h: hStore,
		count: countStore
	};
	setContext("Slider", context);

	onMount(() => {
		children = translateEl.children.length;
		count = children;
		observer = new IntersectionObserver(onIntersect, {
			root: null,
			rootMargin: "-1px"
		});
		observer.observe(sliderEl);
	});
</script>

<section
	class="slider {direction}"
	bind:this={sliderEl}
	bind:clientWidth={width}
	bind:clientHeight={height}
	ontouchstart={handleStart}
	ontouchmove={handleMove}
	ontouchend={handleEnd}
	onmousedown={handleStart}
	onmousemove={handleMove}
	onmouseup={handleEnd}
	onmouseleave={handleEnd}
	style="touch-action: {direction === 'horizontal' ? 'pan-x' : 'pan-y'}; user-select: none; cursor: {isDragging ? 'grabbing' : 'grab'};"
	tabindex="0"
	aria-label="carousel"
>
	<div class="slides" bind:this={translateEl} style={customStyle}>
		<slot />
	</div>
</section>

<style>
	section {
		position: relative;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		z-index: 1;
		overflow: hidden;
	}

	.slides {
		display: flex;
		flex-wrap: wrap;
		position: relative;
		width: 100%;
		height: 100%;
		transition-property: transform;
		z-index: 1;
	}

	.horizontal > .slides {
		flex-direction: row;
	}

	.vertical > .slides {
		flex-direction: column;
	}
</style>
