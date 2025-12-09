<script>
	import { Deck } from '@deck.gl/core';
	import { BitmapLayer } from '@deck.gl/layers';
	import { OrthographicView } from '@deck.gl/core';

	let sliderEl; // component binding
	let deckContainer;
	let deck;

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
			<p><span class="location">{relatedMetadata?.location.replace("$", ", ").replace("?", " ")}</span> | <span class="year">Menu Year: {relatedMetadata?.year}</span></p>
		</div>
	</div>
    <div class="deck-container" bind:this={deckContainer}>
	</div>
</div>

<style>
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