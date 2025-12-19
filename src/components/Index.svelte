<script>
	import { onMount } from "svelte";
	import { browser } from "$app/environment";
	import Modal from "$components/Modal.svelte";
	import loadCsv from "../utils/loadCsv";
	import metaData from "$data/metadata.csv";
	import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
	import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
	import { Squirrel, Turtle, Bird, Brain } from "@lucide/svelte";

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
	let statesList = $state(null);
	let activeFilter = $state(null); // Track the currently selected filter
	let geocoderContainer;
	let geocoder;

	let aspectRatioMap = $state(new Map());

	let menuData = $state(null);
	let menuDataLoaded = $state(false);
	
	// Index structures for quick lookup
	let imageIdToMenuId = $state(new Map());
	let menuIdToImageIds = $state(new Map());

	let highlightedGeographies = ["New York, NY","Detroit, MI", "Boston, MA", "Chicago, IL", "San Francisco, CA", "Los Angeles, CA"];
	
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

	// Expose sootElement to window for console access
	$effect(() => {
		if (browser && sootElement) {
			window.sootElement = sootElement;
			console.log('✅ sootElement exposed to window. Access it with: window.sootElement or just sootElement');
		}
	});

	// Initialize geocoder when container and citiesList are ready
	$effect(() => {
		if (geocoderContainer && citiesList && citiesList.length > 0 && statesList && statesList.length > 0) {
			// Use setTimeout to ensure DOM is ready
			setTimeout(() => {
				initializeGeocoder(citiesList, statesList);
			}, 100);
		}
	});

	async function animalFilter(animal){
		activeFilter = { raw: animal, label: animal };

		await sootElement?.expose?.executeSearch(animal);

	}

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
		
		// Set active filter
		activeFilter = { raw: location, label: label };

		await sootElement?.expose?.executeSearch(location);
		
	}

	async function clearFilter() {
		activeFilter = null;
		// Reset to default view or clear search
		const views = await sootElement?.expose?.getViews();
		if (views && views.length > 0) {
			sootElement?.expose?.setActiveView(views[0].id);
		}
	}

	function initializeGeocoder(cities, states) {
		if (!geocoderContainer || !cities || cities.length === 0 || !states || states.length === 0) {
			return;
		}

		// Clean up existing geocoder if any
		if (geocoder) {
			const geocoderElement = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder');
			if (geocoderElement) {
				geocoderElement.remove();
			}
			geocoder.off('result');
		}
		// Create local geocoder function for autocomplete
		const localGeocoder = (query) => {
			const queryLower = query.toLowerCase().trim();
			
			if (!queryLower) {
				return [];
			}

			let matches = cities
				.filter(city => {
					const label = city[1].toLowerCase();
					return label.includes(queryLower);
				})
				.slice(0, 3) // Limit to 5 results
				.map(city => ({
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [0, 0] // Dummy coordinates, not used
					},
					place_name: city[1],
					properties: {
						rawLocation: city[0],
						formattedLocation: city[1]
					}
				}));

			// Now, also append state matches (states is [value, label] array)
			let stateMatches = [];
			if (states && Array.isArray(states)) {
				stateMatches = states
					.filter(state => {
						const label = state[1].toLowerCase();
						return label.includes(queryLower);
					})
					.slice(0, 2) // Limit to 3 state results to balance with cities
					.map(state => ({
						type: 'Feature',
						geometry: {
							type: 'Point',
							coordinates: [0, 0] // Dummy coordinates, not used
						},
						place_name: state[1],
						properties: {
							rawLocation: state[0],
							formattedLocation: state[1]
						}
					}));
			}
			matches = matches.concat(stateMatches);

			return matches;
		};

		// Initialize Mapbox Geocoder with localGeocoder for autocomplete
		// Set localGeocoderOnly to true to ONLY use local geocoder and exclude Mapbox API results
		geocoder = new MapboxGeocoder({
			accessToken: 'pk.eyJ1IjoiZG9jazQyNDIiLCJhIjoiY2xqc2g3N2o5MHAyMDNjdGhzM2V2cmR3NiJ9.3x1ManoY4deDkAGBuUMnSw', // Not needed when using only localGeocoder
			localGeocoder: localGeocoder,
			localGeocoderOnly: true, // ONLY use local geocoder, exclude all Mapbox API results
			placeholder: 'Search cities, states...',
			externalGeocoder: false, // Disable Mapbox geocoding API
			marker: false,
			zoom: 0,
			minLength: 0, // Show suggestions immediately
			limit: 5 // Limit number of suggestions
		});

		// Handle result selection
		geocoder.on('result', (e) => {
			const result = e.result;
			if (result.properties) {
				const rawLocation = result.properties.rawLocation;
				const formattedLocation = result.properties.formattedLocation;
				filter(rawLocation, formattedLocation);
			}
		});

		// Handle errors
		geocoder.on('error', (e) => {
			console.error('❌ Geocoder error:', e);
		});

		// Add geocoder to container
		const geocoderElement = geocoder.onAdd();
		geocoderContainer.appendChild(geocoderElement);
		
		// Create a Set of valid city names for quick lookup
		const validCityNames = new Set(cities.map(city => city[1]));
		
		// Use MutationObserver to filter out invalid suggestions in real-time
		const suggestionsContainer = geocoderElement.querySelector('.mapboxgl-ctrl-geocoder--suggestions');
		if (suggestionsContainer) {
			const observer = new MutationObserver(() => {
				// Filter suggestions that don't match our local data
				const suggestions = suggestionsContainer.querySelectorAll('.mapboxgl-ctrl-geocoder--suggestion');
				suggestions.forEach(suggestion => {
					const placeName = suggestion.textContent?.trim() || suggestion.innerText?.trim();
					if (placeName && !validCityNames.has(placeName)) {
						suggestion.remove();
					}
				});
			});
			
			observer.observe(suggestionsContainer, {
				childList: true,
				subtree: true
			});
		}
		
		// Also filter on results event as a backup
		geocoder.on('results', (e) => {
			if (e.results && Array.isArray(e.results)) {
				const invalidCount = e.results.filter(result => {
					const placeName = result.place_name;
					return placeName && !validCityNames.has(placeName);
				}).length;
				
				if (invalidCount > 0) {
					// Remove invalid suggestions from DOM
					setTimeout(() => {
						const suggestions = geocoderElement.querySelectorAll('.mapboxgl-ctrl-geocoder--suggestion');
						suggestions.forEach(suggestion => {
							const placeName = suggestion.textContent?.trim() || suggestion.innerText?.trim();
							if (placeName && !validCityNames.has(placeName)) {
								suggestion.remove();
							}
						});
					}, 10);
				}
			}
		});
		
	}

	onMount(async () => {
		await import("soot-webcomponents");

		

		if (browser) {
			(async () => {
				try {
					menuData = await loadCsv("data/menu-map.csv");
						
					if (Array.isArray(metaData)) {
						// Create a unique list of locations from metaData using a Map to dedup by raw location string
						if (Array.isArray(metaData)) {
							const locationsMap = new Map();
							const locationsStateMap = new Map();
							metaData.forEach(row => {
								if (row.city && row.city.trim() !== '') {
									const rawLocation = row.city.trim();
									const formattedLocation = rawLocation.replace(/\$|\?/g, match => match === '$' ? ', ' : ' ');
									locationsMap.set(rawLocation, [rawLocation, formattedLocation]);
								}
								if(row.state && row.state.trim() !== '') {
									const rawLocation = row.state.trim();
									const formattedLocation = rawLocation.replace(/\$|\?/g, match => match === '$' ? ', ' : ' ');
									locationsStateMap.set(rawLocation, [rawLocation, formattedLocation]);
								}
							});
							
							// Convert Map values to array
							citiesList = Array.from(locationsMap.values());
							statesList = Array.from(locationsStateMap.values());
						}
						metaData.forEach(row => {
							if (row.filename) {
								const key = row.filename.replace(/\.jpg$/i, "");
								metadataLookup[key] = row;

							}
						});
					}

					
					// Build index structures for quick lookup
					const imageToMenu = new Map();
					const menuToImages = new Map();
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


					menuData.forEach(row => {
						const imageId = String(row.image_id);
						const width = Number(row.width);
						const height = Number(row.height);
						const aspectRatio = width / height;
						aspectRatioMap.set(imageId, { width, height, aspectRatio });
					});

					imageIdToMenuId = imageToMenu;
					menuIdToImageIds = menuToImages;
										
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

				// Enable scroll-to-zoom behavior
				// The controls are in a nested Vue component, so we need to traverse the tree
				setTimeout(() => {
					try {
						let controls = null;
						
					// Helper function to safely get component name
					const getComponentName = (instance) => {
						try {
							if (!instance?.type) return 'UnknownComponent';
							const type = instance.type;
							// Try various ways to get the name, handling Symbols
							if (typeof type.name === 'string') return type.name;
							if (typeof type.__name === 'string') return type.__name;
							if (typeof type === 'function' && type.name) return type.name;
							return 'UnknownComponent';
						} catch (e) {
							return 'UnknownComponent';
						}
					};

					// Helper function to safely stringify path
					const stringifyPath = (path) => {
						try {
							return path.map(item => {
								if (typeof item === 'string') return item;
								if (typeof item === 'symbol') return item.toString();
								return String(item);
							}).join(' → ');
						} catch (e) {
							return path.length.toString() + ' levels deep';
						}
					};

					// Method 1: Try to find the child component with controls
					const findControls = (vnode, path = [], visited = new WeakSet()) => {
						if (!vnode || visited.has(vnode)) return null;
						visited.add(vnode);
						
						try {
							// Check this node's component instance
							if (vnode.component) {
								const instance = vnode.component;
								const componentName = getComponentName(instance);
								const currentPath = [...path, componentName];
								
								
								// Check setupState for controls
								if (instance.setupState?.controls) {
									const ctrl = instance.setupState.controls;
									// Check if it's a ref
									const actualCtrl = ctrl.value || ctrl;
									if (actualCtrl?.smoothZoomMode !== undefined) {
										return actualCtrl;
									}
								}
								
								// Check ctx for controls
								if (instance.ctx?.controls) {
									const ctrl = instance.ctx.controls;
									const actualCtrl = ctrl.value || ctrl;
									if (actualCtrl?.smoothZoomMode !== undefined) {
										return actualCtrl;
									}
								}
								
								// Check all properties for controls (production builds might use different structure)
								for (const prop of ['setupState', 'ctx', 'exposed', 'exposeProxy', 'data', 'props']) {
									try {
										const obj = instance[prop];
										if (obj && typeof obj === 'object') {
											// Check for controls property
											if (obj.controls) {
												const ctrl = obj.controls;
												const actualCtrl = ctrl.value || ctrl;
												if (actualCtrl?.smoothZoomMode !== undefined) {
													return actualCtrl;
												}
											}
											// Check if the object itself is controls
											if (obj.smoothZoomMode !== undefined) {
												return obj;
											}
										}
									} catch (e) {
										// Skip errors
									}
								}
								
								// Recursively search children - try multiple paths
								const childPaths = ['subTree', 'sub', 'children', 'child'];
								for (const childPath of childPaths) {
									if (instance[childPath]) {
										const result = findControls(instance[childPath], currentPath, visited);
										if (result) return result;
									}
								}
							}
							
							// Check children array
							if (vnode.children && Array.isArray(vnode.children)) {
								for (let i = 0; i < vnode.children.length; i++) {
									const child = vnode.children[i];
									try {
										const childType = getComponentName(child?.component) || (typeof child?.type === 'string' ? child.type : `Child[${i}]`);
										const result = findControls(child, [...path, `child[${i}]`], visited);
										if (result) {
											return result;
										}
									} catch (e) {
										// Silently continue if we can't process this child
									}
								}
							}
							
							// Also check if vnode itself has component property at root level
							if (vnode.component) {
								// Already handled above, but also check nested structures
								const nestedPaths = ['component', 'instance', 'parent'];
								for (const nestedPath of nestedPaths) {
									if (vnode[nestedPath] && vnode[nestedPath] !== vnode.component) {
										const result = findControls({ component: vnode[nestedPath] }, path, visited);
										if (result) return result;
									}
								}
							}
						} catch (e) {
							// If there's an error, just continue searching
							console.warn('⚠️ Error processing vnode:', e);
						}
						
						return null;
					};
						
						// Multiple methods to find controls (work in both dev and production)
						// Helper to get all possible Vue instance entry points
						const getVueInstances = () => {
							const instances = [];
							// Try various ways Vue might expose the instance
							const possiblePaths = [
								sootElement._instance,
								sootElement.__vueParentComponent,
								sootElement.__vue_app__,
								sootElement.$,
								sootElement._vnode?.component,
								sootElement.__vnode?.component
							];
							
							for (const inst of possiblePaths) {
								if (inst) instances.push(inst);
							}
							
							// Also check shadowRoot
							if (sootElement.shadowRoot) {
								const walker = document.createTreeWalker(
									sootElement.shadowRoot,
									NodeFilter.SHOW_ELEMENT
								);
								
								let node;
								while (node = walker.nextNode()) {
									const vueInstances = [
										node.__vueParentComponent,
										node._instance,
										node.__vue_app__
									].filter(Boolean);
									instances.push(...vueInstances);
								}
							}
							
							return instances;
						};
						
						const vueInstances = getVueInstances();
						
						// Method 1: Try _instance.subTree (dev mode)
						if (sootElement._instance?.subTree) {
							controls = findControls(sootElement._instance.subTree);
						}
						
						// Method 2: Try all found Vue instances
						if (!controls && vueInstances.length > 0) {
							for (let i = 0; i < vueInstances.length && !controls; i++) {
								const inst = vueInstances[i];
								// Try subTree if available
								if (inst.subTree) {
									controls = findControls(inst.subTree);
								}
								// Try the instance itself as a vnode
								if (!controls) {
									controls = findControls({ component: inst });
								}
							}
						}
						
						// Method 3: Try accessing through shadowRoot
						if (!controls && sootElement.shadowRoot) {
							console.log('🔍 Method 3: Searching through shadowRoot...');
							// Look for Vue components in shadow DOM
							const allElements = sootElement.shadowRoot.querySelectorAll('*');
							for (const el of allElements) {
								if (el.__vueParentComponent) {
									const result = findControls(el.__vueParentComponent);
									if (result) {
										controls = result;
										break;
									}
								}
								if (el._instance) {
									const result = findControls(el._instance.subTree);
									if (result) {
										controls = result;
										break;
									}
								}
							}
						}
						
						// Method 4: Deep search through all possible Vue instance properties
						if (!controls) {
							console.log('🔍 Method 4: Deep search through all properties...');
							const searchAllProperties = (obj, depth = 0, maxDepth = 5) => {
								if (depth > maxDepth || !obj || typeof obj !== 'object') return null;
								
								// Check if this object has controls
								if (obj.controls && obj.smoothZoomMode !== undefined) {
									console.log('✅ Found controls in object at depth', depth);
									return obj.controls;
								}
								if (obj.smoothZoomMode !== undefined && typeof obj.setSmoothZoomMode === 'function') {
									console.log('✅ Found controls object at depth', depth);
									return obj;
								}
								
								// Search recursively
								for (const key in obj) {
									try {
										if (key === '__vnode' || key === 'subTree' || key === 'component' || key === 'setupState' || key === 'ctx') {
											const result = searchAllProperties(obj[key], depth + 1, maxDepth);
											if (result) return result;
										}
									} catch (e) {
										// Skip circular references
									}
								}
								return null;
							};
							
							// Try searching from various entry points
							const entryPoints = [
								sootElement._instance,
								sootElement.__vueParentComponent,
								sootElement.shadowRoot?.querySelector('*')?.__vueParentComponent
							].filter(Boolean);
							
							for (const entry of entryPoints) {
								controls = searchAllProperties(entry);
								if (controls) break;
							}
						}
						
						// Method 5: Try accessing through expose API (if it exists)
						if (!controls && sootElement.expose) {
							console.log('🔍 Method 5: Checking expose API...');
							try {
								// Some Vue components expose internal state
								const exposeKeys = Object.keys(sootElement.expose);
								console.log('Expose keys:', exposeKeys);
								// Check if there's a controls or getControls method
								for (const key of exposeKeys) {
									if (key.toLowerCase().includes('control')) {
										const val = sootElement.expose[key];
										if (val && val.smoothZoomMode !== undefined) {
											controls = val;
											console.log('✅ Found controls in expose:', key);
											break;
										}
									}
								}
							} catch (e) {
								console.warn('⚠️ Error checking expose:', e);
							}
						}
						
						if (controls) {
							controls.smoothZoomMode = 'SCROLL_TO_ZOOM';
							controls.zoomSpeed = 10;
							controls.panSpeed = .7;
							controls.scrollToZoomSpeed = 0.00030;
							controls.dynamicDampingFactor = .0005;
							controls.dynamicDampingFactorWhilePanning = 0;
							controls.dynamicDampingFactorWhileWheelPanning = 0;
							console.log('✅ Zoom-on-scroll enabled!');
							console.log('Controls:', controls);
						} else {
							console.warn('⚠️ Could not find controls in component tree');
							console.log('💡 Available properties on sootElement:', Object.keys(sootElement));
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
		<Modal bind:showModal {instanceSelected} relatedMetadata={relatedImageIds[1]} relatedImageIds={relatedImageIds[0]} {sootElement} aspectRatioMap={aspectRatioMap}/>
	</div>

	<div id="soot-publication" class="{showModal ? 'soot-publication-hide' : 'soot-publication-show'}">
	<soot-publication
		bind:this={sootElement}
		slug="b21da04d-96b2-47aa-b5c2-4f9c71e4072f"
	>
			<div slot="viewslist">
				<!-- <button style="position:fixed; z-index: 10000000;" on:click={() => {
					showModal = false;
					sootElement?.expose?.deselectInstance();
				}}>
					Close focus view
				</button> -->
			
				<!-- <button style="top: 0; position:fixed; z-index: 10000000;" class="modal-button" on:click={showModal = true}>Show Modal</button> -->
				<div class="geocoder-container" bind:this={geocoderContainer}>
					{#if citiesList}
						<div class="filter-container">
							{#if activeFilter}
								<!-- Show active filter with X button -->
								<button class="filter-button active-filter" onclick={clearFilter}>
									{activeFilter.label} <span class="clear-x">×</span>
								</button>
							{:else}
								<!-- Show all filter buttons -->
								{#each citiesList
									// Sort by index in highlightedGeographies (preserves order from highlightedGeographies), non-matches come last
									.slice()
									.sort((a, b) => {
										const idxA = highlightedGeographies.indexOf(a[1]);
										const idxB = highlightedGeographies.indexOf(b[1]);
										// Both in the highlights: preserve order
										if (idxA !== -1 && idxB !== -1) return idxA - idxB;
										// Only a is in the highlights
										if (idxA !== -1) return -1;
										// Only b is in the highlights
										if (idxB !== -1) return 1;
										// Neither is highlighted, sort alphabetically
										return a[1].localeCompare(b[1]);
									}) 
									.filter(city => highlightedGeographies.includes(city[1]))
								as city}
									<button class="filter-button" onclick={() => filter(city[0], city[1])}>{city[1]}</button>
								{/each}
								<div class="divider"></div>
								<button style="background: #1d3d64;" class="filter-button fancy-button" onclick={() => filter(city[0], city[1])}>Pretenious</button>
								<button style="background: #1d3d64;" class="filter-button fancy-button" onclick={() => filter(city[0], city[1])}>Casual</button>
								<button style="background: #5a1d64;" class="filter-button fancy-button" onclick={() => animalFilter('plaza')}>Plaza Hotel</button>
								<button style="background: #5a1d64;" class="filter-button fancy-button" onclick={() => animalFilter('waldorf')}>Waldorf-Astoria</button>
								<button style="background: #5a1d64;" class="filter-button fancy-button" onclick={() => animalFilter('delmonicos')}>Delmonico's</button>
								<div class="divider"></div>
								<button style="background: #32641d;" class="filter-button fancy-button" onclick={() => filter(city[0], city[1])}>Obscure Dishes</button>
								<button style="background: #32641d;" class="filter-button fancy-button" onclick={() => animalFilter('rare')}>Uncommon Meats</button>
								<button style="background: #000;" class="filter-button fancy-button" onclick={() => animalFilter('squirrel')}><Squirrel size="20" strokeWidth="1.5" color="#ffcf24"/></button>
								<button style="background: #000;" class="filter-button fancy-button" onclick={() => animalFilter('turtle')}><Turtle size="20" strokeWidth="1.5" color="#92e936"/></button>
								<button style="background: #000;" class="filter-button fancy-button" onclick={() => animalFilter('birdie')}><Bird size="20" strokeWidth="1.5" color="#D2F2FF"/></button>
							{/if}

						</div>
					{/if}


				</div>
			</div>
			<div slot="focusview">

			</div>	  
	</soot-publication>
</div>
</svelte:boundary>

<style>
	.divider {
		width: 100%;
		height: 1px;
		background: black;
		opacity: .2;
	}
	.geocoder-container {
		position: absolute;
		top: 10px;
		left: 10px;
		width: 300px;
		z-index: 10000001;
		display: flex;
		flex-direction: column-reverse;
		gap: 10px;
		-webkit-backdrop-filter: blur(2rem);
		backdrop-filter: blur(2rem);
		background-color: #bababa33;
		border-radius: .2rem;
		clip-path: inset(0px round .2rem);
		padding: 1rem;
	}

	.geocoder-container :global(.mapboxgl-ctrl-geocoder) {
		width: 100%;
		/* box-shadow: 0 2px 4px rgba(0,0,0,0.2); */
	}

	.geocoder-container :global(.mapboxgl-ctrl-geocoder input) {
		font-family: 'Atlas Typewriter';
		font-weight: 300;
		-webkit-font-smoothing: antialiased;
	}

	.geocoder-container :global(.mapboxgl-ctrl-geocoder input::placeholder) {
		font-family: 'Atlas Grotesk';
		font-weight: 400;
		font-size: 16px;
		color: #666;
		letter-spacing: -0.02em;
	}

	.geocoder-container :global(.mapboxgl-ctrl-geocoder--suggestions) {
		z-index: 10000002 !important;
		max-height: 300px;
		overflow-y: auto;
	}

	.geocoder-container :global(.mapboxgl-ctrl-geocoder--suggestion) {
		cursor: pointer;
	}

	.filter-container {
		display: flex;
		flex-direction: row;
		gap: 5px;
		width: 100%;
		flex-wrap: wrap;
		
	}

	.filter-container button {
		cursor: pointer;
		font-size: 12px;
		padding: 0;
		text-align: left;
		margin: 0;
		background: #3e3e3e;
		padding: 4px 8px;
		color: #fff;
		text-transform: uppercase;
		font-family: 'Atlas Typewriter';
		font-weight: 300;
		-webkit-font-smoothing: antialiased;
		border-radius: 3px;
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
