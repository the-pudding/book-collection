<script>
	import { ChevronDown, ChevronUp } from '@lucide/svelte';
	import arrowRight from "$svg/arrow-right.svg";
	import {
        getMeta
    } from "$utils/supabase.js";

	let sidebarExpanded = $state(false);
	let obscureList = $state([]);
	let menuUuid = $state(null);

    let { activeFilter, aspectRatioMap, instanceSelected, relatedImageIds, showModal = $bindable(), relatedMetadata, sootElement, tourFilter, metaData, onOpenRandom, dimensions } = $props();

	// --- Pan/zoom state (plain vars — written directly to DOM for zero-latency updates) ---
	let containerEl = $state(null);
	let wrapperEl = $state(null);
	let panX = 0, panY = 0, zoom = 1;

	const pointers = new Map();
	let lastPinchDist = 0;

	function applyTransform() {
		if (wrapperEl) wrapperEl.style.transform = `translate3d(${panX}px,${panY}px,0) scale(${zoom})`;
	}

	function initView() {
		if (!containerEl || !relatedImageIds?.length || !aspectRatioMap) return;
		const { width, height } = containerEl.getBoundingClientRect();
		const firstId = String(relatedImageIds[0]);
		const ar = aspectRatioMap.get(firstId)?.aspectRatio ?? 1;
		const imgH = 1600 / ar;
		const z = Math.min(height / imgH, width / 1600) * 0.65;
		zoom = z;
		panX = width / 2 - 800 * z;
		panY = height / 2 - (imgH / 2) * z;
		applyTransform();
	}

	$effect(() => {
		relatedImageIds;
		aspectRatioMap;
		initView();
	});

	function onPointerDown(e) {
		e.preventDefault();
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		e.currentTarget.setPointerCapture(e.pointerId);
		if (pointers.size === 2) {
			const pts = [...pointers.values()];
			lastPinchDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
		}
	}

	function onPointerMove(e) {
		if (!pointers.has(e.pointerId)) return;
		const prev = pointers.get(e.pointerId);
		pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
		if (pointers.size === 1) {
			panX += e.clientX - prev.x;
			panY += e.clientY - prev.y;
			applyTransform();
		} else if (pointers.size === 2) {
			const pts = [...pointers.values()];
			const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
			if (lastPinchDist > 0) {
				const newZoom = Math.max(0.05, Math.min(8, zoom * (dist / lastPinchDist)));
				const midX = (pts[0].x + pts[1].x) / 2;
				const midY = (pts[0].y + pts[1].y) / 2;
				const rect = containerEl.getBoundingClientRect();
				const cx = midX - rect.left, cy = midY - rect.top;
				const k = newZoom / zoom;
				panX = cx * (1 - k) + panX * k;
				panY = cy * (1 - k) + panY * k;
				zoom = newZoom;
				applyTransform();
			}
			lastPinchDist = dist;
		}
	}

	function onPointerUp(e) {
		pointers.delete(e.pointerId);
		if (pointers.size < 2) lastPinchDist = 0;
	}

	function onWheel(e) {
		e.preventDefault();
		const factor = Math.exp(-e.deltaY * 0.005);
		const newZoom = Math.max(0.05, Math.min(8, zoom * factor));
		const k = newZoom / zoom;
		panX = e.clientX * (1 - k) + panX * k;
		panY = e.clientY * (1 - k) + panY * k;
		zoom = newZoom;
		applyTransform();
	}

	$effect(() => {
		const el = containerEl;
		if (!el) return;
		el.addEventListener('wheel', onWheel, { passive: false });
		return () => el.removeEventListener('wheel', onWheel);
	});

	// Historical CPI data for inflation calculation (base year 1982-84 = 100)
	const cpiData = {
		1850: 8.3, 1860: 9.1, 1870: 12.4, 1880: 10.2, 1890: 9.5,
		1900: 8.5, 1910: 9.8, 1920: 20.0, 1930: 16.7, 1940: 14.0,
		1950: 24.1, 1960: 29.6, 1970: 38.8, 1980: 82.4, 1990: 130.7,
		2000: 172.2, 2010: 218.1, 2020: 258.8, 2026: 315.0
	};

	// Interpolate CPI for any year
	function getCPI(year) {
		if (!year) return null;
		const years = Object.keys(cpiData).map(Number).sort((a, b) => a - b);
		if (year <= years[0]) return cpiData[years[0]];
		if (year >= years[years.length - 1]) return cpiData[years[years.length - 1]];
		
		for (let i = 0; i < years.length - 1; i++) {
			if (year >= years[i] && year <= years[i + 1]) {
				const ratio = (year - years[i]) / (years[i + 1] - years[i]);
				return cpiData[years[i]] + ratio * (cpiData[years[i + 1]] - cpiData[years[i]]);
			}
		}
		return null;
	}

	// Calculate what $1 from the menu year is worth today
	let inflationValue = $derived.by(() => {
		const menuYear = relatedMetadata?.year;
		if (!menuYear) return null;
		const historicalCPI = getCPI(menuYear);
		const currentCPI = cpiData[2026];
		if (!historicalCPI) return null;
		return (currentCPI / historicalCPI).toFixed(2);
	});
    
    function closeModal() {
        showModal = false;
        // sootElement?.expose?.deselectInstance();
    }

	function toggleSidebar() {
		sidebarExpanded = !sidebarExpanded;
	}
	



	$effect(() => {
		const current = instanceSelected;
		if (!current) {
			obscureList = [];
			return;
		}
		const imageId = typeof current === 'string'
			? current.replace?.(/.jpg$/i, '')
			: current?.editableMetadata?.fileName?.replace?.(/.jpg$/i, '');
		if (!imageId) {
			obscureList = [];
			return;
		}
		getMeta(imageId).then((meta) => {
			console.log(meta);
			if (meta && Array.isArray(meta) && meta.length > 0) {
				obscureList = meta.map((row) => ({
					...row,
					obscure_dishes: (row.obscure_dishes || []).filter(
						(ob) => !(ob.background_knowledge || '').includes('Unidentifiable')
					)
				}));
				menuUuid = meta[0]?.uuid;
				console.log(menuUuid);
			} else {
				obscureList = [];
			}
		}).catch(() => {
			obscureList = [];
		});
	});

</script>

<div class="modal">
	<div class="info-container">
		<button class="close-button" onclick={closeModal}>
			<div style="transform: rotate(180deg); width: 20px;">
				{@html arrowRight}
			</div>
			Back

		</button>
		<div class="info-content">
			<p class="year"><span>Menu Year: {relatedMetadata?.year}</span></p>
			<p class="title"><span>{relatedMetadata?.restaurant_title}</span></p>
			{#if relatedMetadata?.geography_city}
				<p class="location">
					<span class="">{decodeURIComponent(relatedMetadata?.geography_city)}</span>
				</p>
			{/if}
			{#if menuUuid}
				<a href="https://digitalcollections.nypl.org/items/{menuUuid}" target="_blank">
					<p class="menu-uuid">Link to NYPL Menu</p>
				</a>
			{/if}
			{#if inflationValue && relatedMetadata?.year}
				<div class="inflation-calc">
					<span class="dollar">$1</span> in {relatedMetadata.year} ≈ <span class="dollar">${inflationValue}</span> today
				</div>
			{/if}
		</div>
		<div class="sidebar" class:expanded={sidebarExpanded}>
			<p class="sidebar-title" style="font-weight: 600; font-size: 1.1em; padding-bottom: 0px;">Dish Definitions</p>
			{#if obscureList}
				{#each obscureList[0]?.obscure_dishes as obscure}
					<p><b>{obscure.obscure_dish}</b> - {obscure.background_knowledge}</p>
				{/each}
				<!-- <p class="sidebar-title" style="font-weight: 600; padding-bottom: 0px;">Full Menu</p>

				{#each obscureList[0]?.dishes as dish}
					<p style="padding-bottom: 0px; padding-top: 0px;">{dish}</p>
				{/each} -->
			{/if}
			<div class="black-scroll" role="button" tabindex="0" aria-expanded={sidebarExpanded} aria-label={sidebarExpanded ? 'Shrink sidebar' : 'Expand sidebar'} onclick={toggleSidebar} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSidebar(); } }}>
				<p>{sidebarExpanded ? 'SHRINK' : 'EXPAND'}</p>
				<span>
					{#if sidebarExpanded}
						<ChevronUp size="15" color="#000" />
					{:else}
						<ChevronDown size="15" color="#000" />
					{/if}
				</span>
			</div>
		</div>
	</div>

	<div
		class="deck-container"
		bind:this={containerEl}
		style="cursor: grab; overflow: hidden;"
		onpointerdown={onPointerDown}
		onpointermove={onPointerMove}
		onpointerup={onPointerUp}
		onpointercancel={onPointerUp}
	>
		{#key relatedImageIds}
			<div class="image-wrapper" bind:this={wrapperEl} style="transform-origin: 0 0; position: absolute; display: flex; gap: 50px; will-change: transform;">
				{#each relatedImageIds ?? [] as imageId}
					<img
						src="https://s3.us-east-1.amazonaws.com/pudding.cool/projects/menu-images/{imageId}.jpg"
						style="width: 1600px; height: auto; display: block; flex-shrink: 0;"
						draggable="false"
						alt=""
					/>
				{/each}
			</div>
		{/key}
	</div>

	{#if onOpenRandom}
		<button class="random-button" onclick={onOpenRandom}>
			{#if dimensions.width < 450}
				Next Menu
			{:else}
				See Another Menu
			{/if}
		</button>
	{/if}
</div>

<style>

	.inflation-calc {
		padding: 12px 10px;
		background: #222;
		color: #fff;
		font-size: 15px;
		font-family: 'Atlas Grotesk', monospace;
		text-align: center;
		border-bottom: 1px solid #000;
		letter-spacing: 0.02em;
		margin-top: 20px;
	}
	.inflation-calc .dollar {
		color: #7bed9f;
		font-weight: 700;
	}
	.sidebar p {
		padding: 10px;
		background: #f7f7f7;
		font-size: 14px;
		font-family: 'Atlas Grotesk';
		margin: 0;
		min-width: 0;
		overflow-wrap: break-word;
		word-break: break-word;
	}
	.expanded .black-scroll {
		top: 550px;
	}
	.black-scroll {
		background: #aaa;
		height: 25px;
		width: 100%;
		position: fixed;
		top: 248px;
		left: 0;
		width: 290px;
		z-index: 1001;
		border: 1px solid #000;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Atlas Grotesk';
		text-align: center;
		cursor: pointer;
		border-top: none;
		display: none;
	}
	.black-scroll span {
		transform: translate(0,1px);
	}
	.black-scroll p {
		color: #000;
		padding: 0;
		margin-right: 5px;
		background: none;
		border: none;
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		line-height: 25px;
		height: 25px;
		font-family: 'Atlas Grotesk';
	}
	.sidebar {
		/* position: absolute;
		left: 0;
		top: 69px; */
		/* width: 290px; */
		width: 100%;
		min-width: 0;
		z-index: 1000;
		border: 1px solid black;
		overflow: scroll;
		padding: 0px;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	.sidebar.expanded {
		height: 500px;
	}
	.info-content p {
		/* line-height: 1.1; */
		/* font-size: 16px; */
	}
	.info-content {
	}
	.title {
		font-size: 28px;
		font-weight: 400;
		line-height: 1.1;
		margin-bottom: 0px;
		margin-top: 0px;
		min-width: 0;
		overflow-wrap: break-word;
		word-break: break-word;
	}
	.title span {
		overflow-wrap: break-word;
		word-break: break-word;
	}
	.location {
		font-weight: 600;
		margin-top: 10px;
		font-family: 'Atlas Grotesk';
		margin-bottom: 30px;
		font-size: 14px;
		
	}
	.year {
		font-size: 20px;
		opacity: 1;
		font-style: italic;
		font-weight: 600;
		font-family: 'EB Garamond';
		margin-bottom: 0px;
	}
	.info-container {
		position: absolute;
		top: 0;
		left: 0;
		background: #F8F9D8;
		width: 300px;
		height: 100%;
		font-family: var(--sans);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		z-index: 100000;
		padding: 20px 10px;
		
	}
    .modal {
        position: absolute;
        top: 0;
        left: 0;
		background-color: #fffef5;
        width: calc(100% - 50px);
        height: 100vh;
        z-index: 1000000000000;
        pointer-events: all;
		box-shadow: 5px 0px 15px 2px rgba(0,0,0,0.37);
    }

    .deck-container {
        position: absolute;
        top: 0px;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .close-button, .random-button {
		background-color: white;
		color: black;
		cursor: pointer;
		z-index: 1001;
		border: 1px solid black;
		display: flex;
		gap: 7px;
		align-items: center;
		text-transform: uppercase;
		font-size: 16px;
		font-weight: 900;
		-webkit-font-smoothing: antialiased;
		padding: 15px 20px;
		font-family: 'EB Garamond';
		touch-action: manipulation;
    }

	.random-button {
		position: fixed;
		top: 100vh;
		right: 0;
		left: 340px;
		width: 210px;
		text-align: center;
		height: 50px;
		gap: 0;
		background: #000;
		margin: 0 auto;
		transform: translate(0, calc(-100% - 30px));
		display: block;
		background: white;
	}

    .close-button:hover {
        background-color: #555;
    }

    .random-button:hover {
        background-color: #777;
    }

	.sidebar-title {
		font-weight: 600;
		padding-bottom: 0;
		font-size: 1.1em;
		min-width: 0;
		overflow-wrap: break-word;
		word-break: break-word;
	}

	@media screen and (max-width: 450px) {
		.info-container {
			width: 100%;
			flex-direction: row;
			gap: 10px;
			flex-wrap: wrap;
			background: none;
			text-align: right;
			align-items: flex-start;
			pointer-events: none;
			padding-bottom: 5px;
			padding-left: 5px;
			padding-right: 5px;
		}
		.year {
			margin-top: 0px;
			font-size: 14px;
		}
		.title {
			font-size: 20px;
			line-height: 1;
		}
		.close-button {
			padding: 10px 13px;
			pointer-events: all;
		}
		.info-content {
			width: calc(100% - 110px);
		}
		.location {
			margin:0;
			font-size: 12px;
			margin-top: 5px;
		}
		.inflation-calc {
			margin: 0;
			margin-top: 0px;
			background: none;
			color: black;
			border: none;
			text-align: right;
			padding: 0;
			font-size: 12px;
		}
		.inflation-calc .dollar {
			color: #000;
		}
		.sidebar {
			align-self: flex-end;
			text-align: left;
			font-size: 11px;
			padding: 5px 0px;
			background: #fff;
			width: 200px;
		}
		.sidebar p {
			font-size: 11px;
			margin: 0;
			padding-bottom: 0px;
			background: none;
			padding-top: 0;
		}
		.sidebar p.sidebar-title {
			margin-bottom: 5px;
		}
		.random-button {
			top: 0;
			left: 5px;
			transform: translate(0, 67px);
			right: auto;
			font-size: 15px;
			width: 97px;
			padding: 0px 5px;
			line-height: 1.1;
		}
	}

</style>