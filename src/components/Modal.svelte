<script>
	import { Deck } from '@deck.gl/core';
	import { IconLayer } from '@deck.gl/layers';
	import { OrthographicView } from '@deck.gl/core';

	let sliderEl; // component binding
	let deckContainer;
	let deck;

    let { instanceSelected, relatedImageIds, showModal = $bindable(), sootElement } = $props();
    
    console.log('Modal props received:', { instanceSelected, relatedImageIds, showModal });
    
    function closeModal() {
        console.log('closeModal')
        showModal = false;
        // sootElement?.expose?.deselectInstance();
    }
	

	// Initialize deck once when container is ready
	$effect(() => {
		if (!deckContainer) return;
		
		console.log('🎬 Initializing Deck.gl container');
		
		deck = new Deck({
			parent: deckContainer,
			initialViewState: {
				target: [0, 0, 0],
				zoom: 0,
				minZoom: -2,
				maxZoom: 5,
				rotationX: 0,
				rotationOrbit: 0
			},
			controller: true,
			views: new OrthographicView(),
			layers: [], // Start with empty layers
			onLoad: () => {
				console.log('✅ Deck.gl loaded successfully');
			},
			onError: (error) => {
				console.error('❌ Deck.gl error:', error);
			}
		});

		console.log('Deck instance created');

		// Cleanup when component unmounts
		return () => {
			console.log('🧹 Cleaning up deck instance');
			if (deck) {
				deck.finalize();
				deck = null;
			}
		};
	});

	// Update layers when relatedImageIds changes
	$effect(() => {
		console.log('🔄 Layer update effect triggered');
		console.log('  - deck exists:', !!deck);
		console.log('  - relatedImageIds:', relatedImageIds);
		
		if (!deck || !relatedImageIds || relatedImageIds.length === 0) {
			console.log('⏳ Waiting - deck or relatedImageIds not ready');
			return;
		}

		console.log('✅ Creating IconLayer for', relatedImageIds.length, 'images');

		const size = 1000;

		// Create data for IconLayer - position images in 3D space
		// Use 512x512 images to stay within WebGL texture limits
		const iconData = relatedImageIds.map((imageId, index) => ({
			imageId,
			url: `https://iiif.nypl.org/iiif/3/${imageId}/full/1000,/0/default.jpg`,
			position: [
				(index - 1) * (size/2 + 1), // Spread horizontally
				0, // Y position
				0  // Z position
			],
			size: size/2
		}));

		console.log('  - Icon data:', iconData);

		// Create NEW IconLayer with updated data - mask: false to show full-color images
		const iconLayer = new IconLayer({
			id: 'image-icons',
			data: iconData,
			getIcon: d => ({
				url: d.url,
				width: size,
				height: size,
				mask: false
			}),
			getPosition: d => d.position,
			getSize: d => d.size,
			getColor: [255, 255, 255, 255],
			sizeUnits: 'common',
			onHover: (info) => {
				if (info.object) {
					console.log('Hovering over:', info.object.imageId);
				}
			},
			onIconError: (error) => {
				console.error('Icon loading error:', error);
			}
		});

		// Update deck with new layer
		console.log('🔄 Updating deck layers...');
		deck.setProps({ layers: [iconLayer] });
		console.log('✅ Deck layers updated!');
	});

</script>

<div class="modal">
    <button class="close-button" onclick={closeModal}>Close</button>
    <div class="deck-container" bind:this={deckContainer}></div>
</div>

<style>
    .modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100vh;
        background-color: #FF0000;
        z-index: 1000;
        pointer-events: all;
    }

    .deck-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
    }

    .close-button {
        position: absolute;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background-color: #333;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 16px;
        z-index: 1001;
    }

    .close-button:hover {
        background-color: #555;
    }

</style>