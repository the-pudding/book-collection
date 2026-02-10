<script>
	import { Deck } from '@deck.gl/core';
	import { BitmapLayer } from '@deck.gl/layers';
	import { OrthographicView } from '@deck.gl/core';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';

	let sliderEl; // component binding
	let deckContainer;
	let deck;
	let sidebarExpanded = $state(false);

    let { activeFilter, aspectRatioMap, instanceSelected, relatedImageIds, showModal = $bindable(), relatedMetadata, sootElement, tourFilter, metaData, onOpenRandom } = $props();

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
    
    // Debug logging (disable in production to reduce main-thread work)
    const DEBUG_MODAL = false;
    $effect(() => {
        if (!DEBUG_MODAL) return;
        console.log('Modal props received:', { instanceSelected, relatedImageIds, showModal, relatedMetadata, aspectRatioMap: aspectRatioMap?.size });
    });
    $effect(() => {
        if (!DEBUG_MODAL || !showModal) return;
        console.log('Modal on load — activeFilter:', activeFilter, 'tourFilter:', tourFilter);
    });
    
    function closeModal() {
        showModal = false;
        // sootElement?.expose?.deselectInstance();
    }

	function toggleSidebar() {
		sidebarExpanded = !sidebarExpanded;
	}
	

	// Build layer list from current relatedImageIds + aspectRatioMap (no Deck creation here)
	function buildLayers(imageIds, aspectMap) {
		if (!imageIds?.length || !aspectMap) return [];
		const size = 1600;
		const spacing = 50;
		const imageInfos = imageIds.map((imageId) => {
			const imageData = aspectMap.get(String(imageId));
			if (imageData) {
				return { imageId, aspectRatio: imageData.aspectRatio };
			}
			return { imageId, aspectRatio: 1 };
		});
		return imageInfos.map((info, index) => {
			const width = size;
			const height = size / info.aspectRatio;
			const xCenter = index * (size + spacing);
			return new BitmapLayer({
				id: `bitmap-${info.imageId}`,
				image: `https://s3.us-east-1.amazonaws.com/pudding.cool/menu-images/${info.imageId}.jpg`,
				bounds: [
					xCenter - width / 2,
					height / 2,
					xCenter + width / 2,
					-height / 2
				],
				pickable: true,
				parameters: { depthTest: false },
				textureParameters: {
					[0x2801]: 0x2601,
					[0x2800]: 0x2601,
					[0x2802]: 0x812f,
					[0x2803]: 0x812f
				},
				onHover: () => {}
			});
		});
	}

	// Stable key for current image set so we only recreate Deck when menu changes, not on every re-render
	let lastIdsKey = '';
	$effect(() => {
		if (!deckContainer || !relatedImageIds?.length || !aspectRatioMap) {
			return;
		}
		const idsKey = relatedImageIds.slice().sort().join(',');
		const layers = buildLayers(relatedImageIds, aspectRatioMap);
		if (layers.length === 0) return;

		const sameMenu = deck && idsKey === lastIdsKey;
		if (sameMenu) {
			deck.setProps({ layers });
			return;
		}

		if (deck) {
			deck.finalize();
			deck = null;
		}
		lastIdsKey = idsKey;

		const rect = deckContainer.getBoundingClientRect();
		const pixelRatio = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1;
		deck = new Deck({
			parent: deckContainer,
			width: rect.width > 0 ? rect.width : undefined,
			height: rect.height > 0 ? rect.height : undefined,
			useDevicePixels: pixelRatio,
			initialViewState: {
				target: [0, 0, 0],
				zoom: -3,
				minZoom: -5,
				maxZoom: 5,
				rotationX: 0,
				rotationOrbit: 0
			},
			controller: true,
			views: new OrthographicView(),
			layers
		});

		return () => {
			if (deck) {
				deck.finalize();
				deck = null;
			}
		};
	});

	// Keep deck canvas sized to container (e.g. when sidebar toggles or window resizes)
	$effect(() => {
		const container = deckContainer;
		const d = deck;
		if (!container || !d) return;
		const ro = new ResizeObserver(() => {
			const { width, height } = container.getBoundingClientRect();
			if (width && height) d.setProps({ width, height });
		});
		ro.observe(container);
		return () => ro.disconnect();
	});


</script>

<div class="modal">
	<div class="info-container">
		<button class="close-button" onclick={closeModal}>Back</button>
		{#if onOpenRandom}
			<button class="random-button" onclick={onOpenRandom}>Random</button>
		{/if}
		<div class="info-content">
			<p><span class="title">{relatedMetadata?.title}</span></p>
			<p>
				{#if relatedMetadata?.city}
				<span class="location">{relatedMetadata?.city?.replace(/\$|\?/g, match => match === '$' ? ', ' : ' ')}</span>
				 | 
				{/if}
				<span class="year">Menu Year: {relatedMetadata?.year}</span>
			</p>
		</div>
	</div>
	<div class="sidebar" class:expanded={sidebarExpanded}>
		{#if inflationValue && relatedMetadata?.year}
		<div class="inflation-calc">
			<span class="dollar">$1</span> in {relatedMetadata.year} ≈ <span class="dollar">${inflationValue}</span> today
		</div>
		{/if}
		<p>The menu presents a stark contrast between very simple, everyday dishes (Oatmeal, Frankfurter Wurst, Salted Mackerel) and an exceptionally luxurious offering from the era, 'Filet v. Schildkrote m. Truffeln' (Fillet of Turtle with Truffles). This blend is characteristic of a high-class establishment, such as a grand hotel or ocean liner, catering to the diverse tastes of an affluent clientele. While many items are basic, the presence of a true haute cuisine dish featuring rare and expensive ingredients like turtle and truffles signifies a highly capable kitchen and elevates the menu to a fine dining level.</p>
		<div class="black-scroll" onclick={toggleSidebar}>
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
    <div class="deck-container" bind:this={deckContainer}>
	</div>
</div>

<style>
	.inflation-calc {
		padding: 12px 10px;
		background: #222;
		color: #fff;
		font-size: 13px;
		font-family: 'Atlas Grotesk', monospace;
		text-align: center;
		border-bottom: 1px solid #000;
		letter-spacing: 0.02em;
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
		height: 100%;
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
		position: absolute;
		left: 0;
		top: 69px;
		width: 290px;
		z-index: 1000;
		height: 180px;
		border: 1px solid black;
		overflow: scroll;
		padding: 0px;
	}

	.sidebar.expanded {
		height: 500px;
	}
	.info-content p {
		line-height: 1.1;
		font-size: 16px;
		margin: 0;
	}
	.info-content {
		padding-left: 10px;
	}
	.title {
		font-size: 16px;
		font-weight: 600;
		margin-right: 10px;
	}
	.location {
		font-weight: 600;
		margin-right: 5px;
	}
	.year, .location {
		font-size: 16px;
		opacity: 1;
		font-family: 'EB Garamond';
	}
	.info-container {
		position: absolute;
		top: 0;
		left: 0;
		background: #fffef5;
		width: 100%;
		height: 70px;
		font-family: var(--sans);
		display: flex;
		align-items: center;
		border-bottom: 1px solid #000;
		
	}
    .modal {
        position: fixed;
        top: 0;
        left: 0;
		background-color: #fffef5;
        width: 100%;
        height: 100vh;
        z-index: 1000000000000;
        pointer-events: all;
    }

    .deck-container {
        position: absolute;
        top: 70px;
        left: 0;
        width: 100%;
        height: calc(100% - 70px);
    }

    .close-button {
        background-color: #333;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 16px;
		font-family: 'Atlas Grotesk';
        z-index: 1001;
		margin-right: 20px;
		width: 100px;
		margin: 0;
		height: 100%;
		border-radius: 0;
    }

    .close-button:hover {
        background-color: #555;
    }

    .random-button {
        background-color: #555;
        color: white;
        border: none;
        cursor: pointer;
        font-size: 16px;
        font-family: 'Atlas Grotesk';
        z-index: 1001;
        margin-right: 10px;
        width: 90px;
        height: 100%;
        border-radius: 0;
    }

    .random-button:hover {
        background-color: #777;
    }

</style>