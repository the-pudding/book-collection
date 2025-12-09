<script>
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import Modal from "$components/Modal.svelte";
	import loadCsv from "../utils/loadCsv";
	import metaData from "$data/metadata.csv"


	let sootElement;
	let metadataLookup = {};
	let currentLayout = null;
	let autocompletes = [];
	let lastSearchText = null;
	let searchInput = "";
	let showAutocompletes = false;
	let showModal = $state(false);
	let instanceSelected = $state(null);
	let citiesList = $state(null);
	let activeFilter = $state(null); // Track the currently selected filter

	let menuData = $state(null);
	let menuDataLoaded = $state(false);
	
	// Index structures for quick lookup
	let imageIdToMenuId = $state(new Map());
	let menuIdToImageIds = $state(new Map());
	
	/**
	 * Get all image_ids that share the same menu_id as the given image_id
	 * @param {string|number} imageId - The image_id to look up
	 * @returns {string[]} Array of image_ids (excluding the input image_id)
	 */
	function getRelatedImageIds(imageId){

		const menuId = imageIdToMenuId.get(String(imageId));
		const relatedIds = menuIdToImageIds.get(menuId) || [];
		// Return a NEW array so Svelte detects changes
		const result = [...relatedIds];
		return [result, metadataLookup[imageId]];
	}

	// Reactive: Get related images for the currently selected instance
	let relatedImageIds = $derived.by(() => {
		if (!instanceSelected) {
			const defaultRelated = []; //getRelatedImageIds("1603597");
			return defaultRelated;
		}
		
		// Handle both string (from manual clicks) and object (from SOOT)
		let imageId;
		if (typeof instanceSelected === 'string') {
			// Direct image_id from manual button clicks
			imageId = instanceSelected;
			console.log('Using direct image ID:', imageId);
		} else if (typeof instanceSelected === 'object' && instanceSelected.id) {
			// Object from getInstanceDetails() - the id might be a SOOT UUID
			// We need to extract the actual NYPL image ID from metadata
			imageId = instanceSelected.editableMetadata.fileName.replace(".jpg", "");
			console.log('Selected instance object:', instanceSelected);
			console.log('Instance ID from SOOT:', imageId);
			
			// Check if there's a better image ID in the metadata
			if (instanceSelected.editableMetadata?.fileName) {
				console.log('Filename:', instanceSelected.editableMetadata.fileName);
			}
		}
		
		// Try to get related images using the instance ID
		const related = getRelatedImageIds(imageId);
		console.log('Related images for', imageId, ':', related);
		
		return related;
	});

	// Track when relatedImageIds changes
	$effect(() => {
		console.log('📦 Index: relatedImageIds updated:', relatedImageIds);
	});

	async function filter(location, label){
		// showModal = true;
		// const autocompletes = await sootElement?.expose?.getAutocompletions("tag");
		// console.log(autocompletes)

		// const layout = `{
		// 		type: 'FILTER_TO_TAG',
		// 		instanceId: null,
		// 		objectVersionId: null,
		// 		propertyId: '8b5df9fc-8e50-4d23-a6cb-4df765173d40',
		// 		tagId: '0d467b2b-8583-4d25-9dbc-3221671a5c51'
		// }`;

		console.log('Filtering for:', location);
		
		// Set active filter
		activeFilter = { raw: location, label: label };

		await sootElement?.expose?.executeSearch(location);
		
	}

	async function clearFilter() {
		activeFilter = null;
		// Reset to default view or clear search
		const views = await sootElement?.expose?.getViews();
		console.log('getViews', views);
		if (views && views.length > 0) {
			sootElement?.expose?.setActiveView(views[0].id);
		}
	}

	onMount(async () => {
		await import("soot-webcomponents");

		

		if (browser) {
			(async () => {
				try {
					menuData = await loadCsv("data/menu-map.csv");
					console.log('🔍 menuData:', menuData);
						
					if (Array.isArray(metaData)) {
						// Create a unique list of locations from metaData using a Map to dedup by raw location string
						if (Array.isArray(metaData)) {
							const locationsMap = new Map();
							metaData.forEach(row => {
								if (row.location && row.location.trim() !== '') {
									const rawLocation = row.location.trim();
									const formattedLocation = rawLocation.replace(/\$|\?/g, match => match === '$' ? ', ' : ' ');
									locationsMap.set(rawLocation, [rawLocation, formattedLocation]);
								}
							});
							
							// Convert Map values to array
							citiesList = Array.from(locationsMap.values());
						}
						metaData.forEach(row => {
							if (row.filename) {
								const key = row.filename.replace(/\.jpg$/i, "");
								metadataLookup[key] = row;

							}
						});
					}

					console.log('🔍 metaDataLookup:', metadataLookup);

					
					// Build index structures for quick lookup
					const imageToMenu = new Map();
					const menuToImages = new Map();
					
					if (menuData.length > 0) {
						console.log('📄 CSV Columns:', Object.keys(menuData[0]));
					}

					menuData.forEach(row => {
						const menuId = String(row.menu_id);
						const imageId = String(row.image_id);
						// Try to find page number column (page, page_number, order, etc.)
						const page = parseInt(row.page || row.page_number || row.order || 0);
						
						// Map image_id -> menu_id
						imageToMenu.set(imageId, menuId);
						
						// Map menu_id -> array of objects temporarily
						if (!menuToImages.has(menuId)) {
							menuToImages.set(menuId, []);
						}
						menuToImages.get(menuId).push({ id: imageId, page });
					});

					// Sort by page number and extract IDs
					for (const [menuId, images] of menuToImages) {
						images.sort((a, b) => a.page - b.page);
						menuToImages.set(menuId, images.map(img => img.id));
					}
					
					imageIdToMenuId = imageToMenu;
					menuIdToImageIds = menuToImages;
					
					console.log('📊 Menu index built:', {
						totalImages: imageToMenu.size,
						totalMenus: menuToImages.size
					});
					
					menuDataLoaded = true;
				} catch (error) {
					console.error('❌ Error loading menu data:', error);
				}
			})();

			sootElement.addEventListener('loadComplete', async (e) => {


// 				type
// : 
// "SAVED_VIEW"
// viewId
// : 
// "1fb5eb36-a820-4eda-a525-7a4445d6196c"

				console.log('✨ SOOT space loaded!', e.detail);
				console.log('📋 expose methods available:', Object.keys(sootElement?.expose || {}));
				console.log(sootElement.expose.getAutocompletions())

				// Enable scroll-to-zoom behavior
				// The controls are in a nested Vue component, so we need to traverse the tree
				setTimeout(() => {
					try {
						let controls = null;
						
						// Method 1: Try to find the child component with controls
						const findControls = (vnode) => {
							if (!vnode) return null;
							
							// Check this node's component instance
							if (vnode.component) {
								const instance = vnode.component;
								
								// Check setupState for controls
								if (instance.setupState?.controls) {
									const ctrl = instance.setupState.controls;
									// Check if it's a ref
									const actualCtrl = ctrl.value || ctrl;
									if (actualCtrl?.smoothZoomMode !== undefined) {
										console.log('Found controls in component setupState');
										return actualCtrl;
									}
								}
								
								// Check ctx for controls
								if (instance.ctx?.controls) {
									const ctrl = instance.ctx.controls;
									const actualCtrl = ctrl.value || ctrl;
									if (actualCtrl?.smoothZoomMode !== undefined) {
										console.log('Found controls in component ctx');
										return actualCtrl;
									}
								}
								
								// Recursively search children
								if (instance.subTree) {
									const result = findControls(instance.subTree);
									if (result) return result;
								}
							}
							
							// Check children array
							if (vnode.children && Array.isArray(vnode.children)) {
								for (const child of vnode.children) {
									const result = findControls(child);
									if (result) return result;
								}
							}
							
							return null;
						};
						
						// Start search from _instance
						if (sootElement._instance) {
							console.log('🔍 Searching component tree for controls...');
							controls = findControls(sootElement._instance.subTree);
						}
						
						if (controls) {
							controls.smoothZoomMode = 'SCROLL_TO_ZOOM';
							console.log('✅ Zoom-on-scroll enabled!');
							console.log('Controls:', controls);
						} else {
							console.warn('⚠️ Could not find controls in component tree');
							console.log('💡 Try using Ctrl/Cmd+Scroll to zoom as a workaround');
						}
					} catch (error) {
						console.error('❌ Error enabling zoom-on-scroll:', error);
					}
				}, 500); // Longer delay to ensure component tree is fully built

				
				sootElement.addEventListener("selectInstance", async (event) => {
					instanceSelected = await sootElement?.expose?.getInstanceDetails(event.detail.eventData.instanceId);
					console.log(instanceSelected)
					showModal = true;
				}
			)	
			});



			sootElement.addEventListener('changeLayout', (e) => {
				console.group('🔄 Layout Changed');
				console.log('Timestamp:', new Date().toLocaleTimeString());
				
				const layout = e.detail.eventData.layout;
				const triggerType = e.detail.eventData.triggerType;

				console.log(e.detail)
				
				console.log('Trigger Type:', triggerType);
				console.log('New Layout:', layout);
				
				if (layout.type === 'SAVED_VIEW') {
					console.log('  └─ Layout Type: Saved View');
					console.log('  └─ View ID:', layout.viewId);
					if (layout.focusOnInstanceId) {
						console.log('  └─ Focused Instance:', layout.focusOnInstanceId);
					}
				} else if (layout.type === 'SEARCH') {
					console.log('  └─ Layout Type: Search');
					console.log('  └─ Search Query Type:', layout.query.type);
					if (layout.query.type === 'TEXT') {
						console.log('  └─ Search Text:', layout.query.text);
						lastSearchText = layout.query.text;
					} else if (layout.query.type === 'SEE_SIMILAR') {
						console.log('  └─ Similar to image');
						lastSearchText = 'Similar to image';
					} else if (layout.query.type === 'FILTER_TO_TAG') {
						console.log('  └─ Tag ID:', layout.query.tagId);
						console.log('  └─ Property ID:', layout.query.propertyId);
						if (layout.query.instanceId) {
							console.log('  └─ Instance ID:', layout.query.instanceId);
						}
						if (layout.query.objectVersionId) {
							console.log('  └─ Object Version ID:', layout.query.objectVersionId);
						}
						lastSearchText = 'Filtered to tag';
					} else if (layout.query.type === 'METADATA_SEARCH') {
						console.log('  └─ Metadata search');
						lastSearchText = 'Metadata search';
					}
				}
				
				console.groupEnd();
				currentLayout = layout;
			});

		}
	});
</script>


<svelte:boundary onerror={(e) => console.error(e)}>

	{#if menuData}
		<div style="position: fixed; height:100px; z-index: 10000000; margin-top: 100px; overflow-y: scroll;">
			{#each menuData.slice(0,100) as menuPage, index}
				<!-- <button style="display: block;" on:click={() => {
					showModal = true;
					instanceSelected = menuPage.image_id;
				}}>
					{menuPage.image_id}
				</button> -->
			{/each}
		</div>
	{/if}


	<div class="modal-container {showModal ? 'show-modal' : 'hide-modal'}">
		<Modal bind:showModal {instanceSelected} relatedMetadata={relatedImageIds[1]} relatedImageIds={relatedImageIds[0]} {sootElement} />
	</div>

	<div id="soot-publication" class="{showModal ? 'soot-publication-hide' : 'soot-publication-show'}">
		<soot-publication
			bind:this={sootElement}
			slug="c0a2119c-fbde-4195-84d1-54168f98af48"
		>
			<div slot="viewslist">
				<!-- <button style="position:fixed; z-index: 10000000;" on:click={() => {
					showModal = false;
					sootElement?.expose?.deselectInstance();
				}}>
					Close focus view
				</button> -->
			
				<!-- <button style="top: 0; position:fixed; z-index: 10000000;" class="modal-button" on:click={showModal = true}>Show Modal</button> -->
				{#if citiesList}
					<div class="filter-container">
						{#if activeFilter}
							<!-- Show active filter with X button -->
							<button class="filter-button active-filter" onclick={clearFilter}>
								{activeFilter.label} <span class="clear-x">×</span>
							</button>
						{:else}
							<!-- Show all filter buttons -->
							{#each citiesList as city}
								<button class="filter-button" onclick={() => filter(city[0], city[1])}>{city[1]}</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
			<div slot="focusview">

			</div>	  
		</soot-publication>
	</div>
</svelte:boundary>

<style>
	.filter-container {
		position: absolute;
		top: 0;
		left: 0;
		display: flex;
		flex-direction: column;
		gap: 0px;
		height: 100px;
		overflow-y: scroll;
	}

	.filter-container button {
		cursor: pointer;
		width: 200px;
		font-size: 12px;
		padding: 0;
		text-align: left;
		margin: 0;
	}

	.filter-button.active-filter {
		display: flex;
		justify-content: space-between;
		align-items: center;
		background-color: #333;
		color: white;
		padding: 4px 8px;
		border-radius: 4px;
	}

	.clear-x {
		font-size: 16px;
		font-weight: bold;
		margin-left: 8px;
		cursor: pointer;
	}

	.clear-x:hover {
		color: #ff6666;
	}
	.soot-publication-hide {
		/* visibility: hidden; */
	}
	.soot-publication-show {
	}
	.hide {
		display: none;
	}
	.hide-modal {
		/* visibility: hidden; */
	}
	.modal-container {
		transform: translate(-100%,0);
		transition: transform .2s ease-in-out;
		transition-delay: .0s;		
		position: relative;
    	z-index: 10000000;

	}
	.modal-container.show-modal {
		/* visibility: visible; */
		transform: translate(0,0);
	}
</style>
