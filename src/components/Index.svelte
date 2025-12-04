<script>
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import Modal from "$components/Modal.svelte";
	import loadCsv from "../utils/loadCsv";


	let sootElement;
	let currentLayout = null;
	let autocompletes = [];
	let lastSearchText = null;
	let searchInput = "";
	let showAutocompletes = false;
	let showModal = $state(false);
	let instanceSelected = $state(null);

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

		console.log('🔍 Getting related images for:', imageId);
		const menuId = imageIdToMenuId.get(String(imageId));
		console.log('🔍 menuId:', menuId);
		const relatedIds = menuIdToImageIds.get(menuId) || [];
		// Return a NEW array so Svelte detects changes
		const result = [...relatedIds];
		console.log('🔍 Returning related images:', result);

		return result;
	}

	// Reactive: Get related images for the currently selected instance
	let relatedImageIds = $derived.by(() => {
		console.log('🔄 relatedImageIds $derived.by triggered, instanceSelected:', instanceSelected);
		if (!instanceSelected) {
			console.log('No instance selected, using default image ID: 1603597');
			const defaultRelated = []; //getRelatedImageIds("1603597");
			console.log('Default related images:', defaultRelated);
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

	async function filter(){
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

		await sootElement?.expose?.executeSearch("New?York$NY");
		
	}

	onMount(async () => {
		await import("soot-webcomponents");

		if (browser) {
			(async () => {
				try {
					menuData = await loadCsv("/menu-map.csv");
					console.log('🔍 menuData:', menuData);
					
					// Build index structures for quick lookup
					const imageToMenu = new Map();
					const menuToImages = new Map();
					
					menuData.forEach(row => {
						const menuId = String(row.menu_id);
						const imageId = String(row.image_id);
						
						// Map image_id -> menu_id
						imageToMenu.set(imageId, menuId);
						
						// Map menu_id -> array of image_ids
						if (!menuToImages.has(menuId)) {
							menuToImages.set(menuId, []);
						}
						menuToImages.get(menuId).push(imageId);
					});
					
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


	<div class="{showModal ? 'show' : 'hide'}">
		<Modal bind:showModal {instanceSelected} {relatedImageIds} {sootElement} />
	</div>

	<div id="soot-publication" class="{showModal ? 'soot-publication-hide' : 'soot-publication-show'}">
		<soot-publication
			bind:this={sootElement}
			slug="c0a2119c-fbde-4195-84d1-54168f98af48"
		>
			<div slot="viewslist">
				<button style="position:fixed; z-index: 10000000;" on:click={() => {
					showModal = false;
					sootElement?.expose?.deselectInstance();
				}}>
					Close focus view
				</button>
			
				<!-- <button style="top: 0; position:fixed; z-index: 10000000;" class="modal-button" on:click={showModal = true}>Show Modal</button> -->
				<button class="filter-button" on:click={filter}>Filter</button>					
			</div>
			<div slot="focusview">

			</div>	  
		</soot-publication>
	</div>
</svelte:boundary>

<style>
	.soot-publication-hide {
		visibility: hidden;
	}
	.soot-publication-show {
	}
	.hide {
		display: none;
	}
	.filter-button {
		position: fixed;
		top: 0;
		right: 0;
		z-index: 1000;
	}
	.modal-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	}
	.modal-container.show {
		display: block;
	}
</style>
