<script>
	import { Deck } from '@deck.gl/core';
	import { BitmapLayer } from '@deck.gl/layers';
	import { OrthographicView } from '@deck.gl/core';
	import { ChevronDown, ChevronUp } from '@lucide/svelte';

	let sliderEl; // component binding
	let deckContainer;
	let deck;
	let sidebarExpanded = $state(false);

    let { instanceSelected, relatedImageIds, showModal = $bindable(), relatedMetadata, sootElement } = $props();
    
    // Log when props change (must be in $effect to react to changes)
    $effect(() => {
        console.log('Modal props received:', { 
            instanceSelected, 
            relatedImageIds, 
            showModal, 
            relatedMetadata 
        });
    });
    
    function closeModal() {
        console.log('closeModal')
        showModal = false;
        // sootElement?.expose?.deselectInstance();
    }

	function toggleSidebar() {
		sidebarExpanded = !sidebarExpanded;
	}
	

	// Initialize and update deck instance when dependencies change
	$effect(() => {
		console.log('🔄 Effect triggered - Container:', !!deckContainer, 'Images:', relatedImageIds?.length);
		
		if (!deckContainer || !relatedImageIds || relatedImageIds.length === 0) {
			console.log('⏳ Waiting for container or images...');
			return;
		}

		// Clean up previous instance first (this forces a true reset)
		if (deck) {
			console.log('🧹 Cleaning up previous deck instance...');
			deck.finalize();
			deck = null;
		}

		console.log('✅ Fetching info for', relatedImageIds.length, 'images');

		// Fetch dimensions first
		Promise.all(relatedImageIds.map(id => getImageInfo(id))).then(imageInfos => {
			// Check if we're still mounted
			if (!deckContainer) return;

			const size = 1600;
			const spacing = 50;

			const layers = imageInfos.map((info, index) => {
				const width = size;
				const height = size / info.aspectRatio;
				const xCenter = index * (size + spacing);
				
				return new BitmapLayer({
					id: `bitmap-${info.imageId}-${Date.now()}`,
					image: `https://iiif.nypl.org/iiif/3/${info.imageId}/full/^1600,/0/default.jpg`,
					bounds: [
						xCenter - width/2,  // left
						height/2,           // bottom
						xCenter + width/2,  // right
						-height/2           // top
					],
					pickable: true,
					parameters: {
						depthTest: false
					},
					textureParameters: {
						[0x2801]: 0x2601, // GL.LINEAR
						[0x2800]: 0x2601, // GL.LINEAR
						[0x2802]: 0x812F, // CLAMP_TO_EDGE
						[0x2803]: 0x812F, // CLAMP_TO_EDGE
					},
					onHover: (event) => {
						if (event.object) {
							console.log('Hovering over:', info.imageId);
						}
					}
				});
			});

			console.log('🏗️ Creating new Deck instance...');
			
			deck = new Deck({
				parent: deckContainer,
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
				layers: layers,
				onLoad: () => console.log('✅ Deck loaded'),
				onError: (e) => console.error('❌ Deck error:', e)
			});
		});

		// Cleanup on unmount or dependency change
		return () => {
			if (deck) {
				console.log('🧹 Finalizing deck on cleanup');
				deck.finalize();
				deck = null;
			}
		};
	});

	// Fetch image dimensions from IIIF info.json
	async function getImageInfo(imageId) {
		try {
			const res = await fetch(`https://iiif.nypl.org/iiif/3/${imageId}/info.json`);
			const info = await res.json();
			return {
				imageId,
				width: info.width,
				height: info.height,
				aspectRatio: info.width / info.height
			};
		} catch (error) {
			console.error(`Failed to fetch info for ${imageId}:`, error);
			return { imageId, width: 1000, height: 1000, aspectRatio: 1 }; // Fallback
		}
	}

</script>

<div class="modal">
	<div class="info-container">
		<button class="close-button" onclick={closeModal}>Back</button>
		<div class="info-content">
			<p><span class="title">{relatedMetadata?.title}</span></p>
			<p><span class="location">{relatedMetadata?.location.replace(/\$|\?/g, match => match === '$' ? ', ' : ' ')}</span>{relatedMetadata?.location ? ' | ' : ''}<span class="year">Menu Year: {relatedMetadata?.year}</span></p>
		</div>
	</div>
	<div class="sidebar" class:expanded={sidebarExpanded}>
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
		font-family: 'Atlas Typewriter';
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
		font-size: 14px;
		opacity: 0.8;
		font-family: var(--mono);
	}
	.info-container {
		position: absolute;
		top: 0;
		left: 0;
		background: #f7f7f7;
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
		background-color: #f7f7f7;
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

</style>