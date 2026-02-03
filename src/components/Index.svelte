<script>
	import { onMount, getContext } from "svelte";
	import { browser } from "$app/environment";
	import Modal from "$components/Modal.svelte";
	import loadCsv from "../utils/loadCsv";
	import metaData from "$data/metadata.csv";
	import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
	import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
	import { Squirrel, Turtle, Bird, Brain, ChevronRight, ChevronLeft } from "@lucide/svelte";
	import Header from "$components/Header.svelte";
	import { fade } from "svelte/transition";


	let sootElement;
	let metadataLookup = {};
	let currentLayout = null;
	let autocompletes = [];
	let controls = null;
	let css = null;  // compactSpaceScene reference for zooming
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
	let tour = $state(true);
	let tourMinimized = $state(false);

	let aspectRatioMap = $state(new Map());

	let menuData = $state(null);
	let menuDataLoaded = $state(false);

	let copy = getContext("copy");
	
	// Index structures for quick lookup
	let imageIdToMenuId = $state(new Map());
	let menuIdToImageIds = $state(new Map());

	let highlightedGeographies = ["New York, NY","Detroit, MI", "Boston, MA", "Chicago, IL", "San Francisco, CA", "Los Angeles, CA"];
	let tourStep = $state(0);
	let tourText = copy.body;
	
	// Views lookup by ID and current saved layout
	let viewsById = $state({});
	let savedLayout = $state(null);
	
	// Menu type label mapping
	const menuTypeLabels = {
		0: 'Restaurant',
		1: 'Ship/Train',
		2: 'Event'
	};
	
	/**
	 * Get the display label for a category based on the current savedLayout
	 * @param {string|number} value - The raw label value
	 * @returns {string} The formatted display label
	 */
	function getLabelContent(value) {
		// Check if current savedLayout is the menuType view
		const currentView = savedLayout ? viewsById[savedLayout] : null;
		


		if (currentView?.displayName === 'state') {
			if(value == "n/a"){
				return "Location Missing"
			}
			return value;
		}
		if (currentView?.displayName === 'menuType') {
			// Use menuType mapping
			const numValue = parseInt(value);
			return menuTypeLabels[numValue] ?? value;
		}
		
		// Default: return the value as-is
		return value;
	}
	
	// // Smooth zoom function
	// function smoothZoom(controls, targetScale, duration = 1000) {
	// 	const camera = controls.object;
	// 	const startZ = camera.position.z;
	// 	const endZ = startZ * targetScale;
	// 	const startTime = performance.now();
	// 	
	// 	function animate() {
	// 		const elapsed = performance.now() - startTime;
	// 		const progress = Math.min(elapsed / duration, 1);
	// 		
	// 		// Ease out cubic for smooth deceleration
	// 		const eased = 1 - Math.pow(1 - progress, 3);
	// 		
	// 		camera.position.z = startZ + (endZ - startZ) * eased;
	// 		controls.update();
	// 		
	// 		if (progress < 1) {
	// 			requestAnimationFrame(animate);
	// 		}
	// 	}
	// 	
	// 	animate();
	// }

	// Smooth zoom to a specific instance
	// zoomDistance: how far camera sits from instance (smaller = more zoomed in)
	// offsetPerZoom: nudge camera right/up per unit of zoom (e.g. {x: 0.02, y: 0.02})
	function zoomToInstance(controls, css, instanceId, duration = 600, zoomDistance = 10, offsetPerZoom = { x: 0.02, y: 0.02 }) {
		const position = css.getInstancePosition(instanceId);
		if (!position) return;
		
		const offsetX = (offsetPerZoom?.x ?? 0) * zoomDistance;
		const offsetY = (offsetPerZoom?.y ?? 0) * zoomDistance;
		
		const camera = controls.object;
		const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
		const endPos = { x: position.x + offsetX, y: position.y + offsetY, z: position.z + zoomDistance };
		const startTime = performance.now();
		
		function animate() {
			const elapsed = performance.now() - startTime;
			const progress = Math.min(elapsed / duration, 1);
			
			// Ease in-out quad
			const eased = progress < 0.5 
				? 2 * progress * progress 
				: 1 - Math.pow(-2 * progress + 2, 2) / 2;
			
			camera.position.x = startPos.x + (endPos.x - startPos.x) * eased;
			camera.position.y = startPos.y + (endPos.y - startPos.y) * eased;
			camera.position.z = startPos.z + (endPos.z - startPos.z) * eased;
			
			// Also move target to keep camera looking at instance
			controls.target.x = camera.position.x;
			controls.target.y = camera.position.y;
			controls.target.z = 0;
			
			controls.update();
			
			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		}
		
		animate();
	}

	// Watch for tourStep changes and apply filters
	$effect(() => {

		if (tourStep === 1) {
			changeFilterByIndex(2);
		}
		if(tourStep === 2) {
			// controls.maxDistance = 2.5;
			filter("focus")
			setTimeout(() => {
				zoomToInstance(controls, css, "de0e09c1-172d-4e38-ae5a-ddf243184d77", 600, 1, { x: -.5, y: -.3 });
				// setTimeout(() => {
				// 	controls.maxDistance = 2.5;
				// }, 1000)
			}, 1000)
		}
		if(tourStep === 3) {		
			filter("delmonicos");
			setTimeout(() => {
				zoomToInstance(controls, css, "e26ff4ec-017d-4f31-9745-3cc6ac618325", 1500, 2.5, { x: -.2, y: -0.15 });
			}, 1000)
		}
		if(tourStep === 4) {			
			filter("off");
			setTimeout(() => {
				zoomToInstance(controls, css, "ec6eb893-c3d9-49d5-af49-c1c2aa036bd4", 1500, 2.5, { x: -.2, y: -0.15 });
			}, 1000)
		}
		if(tourStep === 5) {		
			filter("hist");
			setTimeout(() => {
				zoomToInstance(controls, css, "e26ff4ec-017d-4f31-9745-3cc6ac618325", 1500, 2.5, { x: -.2, y: -0.15 });
			}, 1000)
		}
		if(tourStep === 6) {		
			clearFilter();
		}
	});
	
	// Category labels with screen positions
	let screenLabels = $state([]);
	let labelsVisible = $state(true);
	
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

	async function filter(location){
		// Set active filter
		activeFilter = { raw: location, label: location };
		// Ensure location is urlencoded before sending to executeSearch
		const encodedLocation = encodeURIComponent(location);

		console.log('encodedLocation', encodedLocation);

		await sootElement?.expose?.executeSearch(encodedLocation);
		
	}

	async function clearFilter() {
		activeFilter = null;
		controls.maxDistance = 300;
		// Reset to default view or clear search
		const views = await sootElement?.expose?.getViews();
		if (views && views.length > 0) {
			sootElement?.expose?.setActiveView(views[0].id);
		}
	}

	async function changeFilterByIndex(index) {
		const views = await sootElement?.expose?.getViews();
		if (views && views.length > 0) {
			activeFilter = { raw: views[index].displayName, label: views[index].displayName };
			sootElement?.expose?.setActiveView(views[index].id);
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
				.filter(city => city.toLowerCase().includes(queryLower))
				.slice(0, 3)
				.map(city => ({
					type: 'Feature',
					geometry: {
						type: 'Point',
						coordinates: [0, 0]
					},
					place_name: city,
					properties: {
						location: city
					}
				}));

			// Also append state matches
			if (states && Array.isArray(states)) {
				const stateMatches = states
					.filter(state => state.toLowerCase().includes(queryLower))
					.slice(0, 2)
					.map(state => ({
						type: 'Feature',
						geometry: {
							type: 'Point',
							coordinates: [0, 0]
						},
						place_name: state,
						properties: {
							location: state
						}
					}));
				matches = matches.concat(stateMatches);
			}

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
			if (result.properties?.location) {
				filter(result.properties.location);
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
		const validCityNames = new Set(cities);
		
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
						// Create unique lists of locations from metaData
						const citiesSet = new Set();
						const statesSet = new Set();
						metaData.forEach(row => {
							if (row.city && row.city.trim() !== '') {
								citiesSet.add(row.city.trim());
							}
							if (row.state && row.state.trim() !== '') {
								statesSet.add(row.state.trim());
							}
						});
						
						citiesList = Array.from(citiesSet);
						statesList = Array.from(statesSet);
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
				console.log(sootElement.expose)
				const views = await sootElement?.expose?.getViews();
				console.log(views)

				if (views && views.length > 0) {
					// Build viewsById lookup object
					viewsById = views.reduce((acc, view) => {
						acc[view.id] = view;
						return acc;
					}, {});
					
					// Set savedLayout to the first view's ID
					savedLayout = views[0].id;
					
					sootElement?.expose?.setActiveView(views[0].id);
				}

				setTimeout(() => {
					try {

						
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
							console.log(controls)
							controls.smoothZoomMode = 'SCROLL_TO_ZOOM';
							controls.minDistance = .5;
							controls.maxDistance = 300;
							// controls.zoomSpeed = 10;
							// controls.panSpeed = .7;
							// controls.scrollToZoomSpeed = 0.00030;
							// controls.dynamicDampingFactor = .0005;
							// controls.dynamicDampingFactorWhilePanning = 0;
							// controls.dynamicDampingFactorWhileWheelPanning = 0;
							// console.log('✅ Zoom-on-scroll enabled!');
							// console.log('Controls:', controls);
						} else {
							console.warn('⚠️ Could not find controls in component tree');
							console.log('💡 Available properties on sootElement:', Object.keys(sootElement));
							console.log('💡 Try using Ctrl/Cmd+Scroll to zoom as a workaround');
						}
					} catch (error) {
						console.error('❌ Error enabling zoom-on-scroll:', error);
					}
				}, 500); // Longer delay to ensure component tree is fully built

				setTimeout(() => {
					try {
						console.group('🏷️ Setting up category labels...');
						
						// Use _instance which is available in both dev and production
						const rootComp = sootElement._instance;
						if (!rootComp) {
							console.warn('Could not find root Vue component (_instance)');
							console.groupEnd();
							return;
						}
						
						// Navigate: SootPublication -> SceneManager -> MainComponent
						const sceneManager = rootComp.subTree?.children?.[0]?.component;
						if (!sceneManager) {
							console.warn('Could not find SceneManager');
							console.groupEnd();
							return;
						}
						
						const mainComp = sceneManager.subTree?.children?.[3]?.component;
						if (!mainComp) {
							// Try alternative paths - the index might differ
							const children = sceneManager.subTree?.children || [];
							let found = null;
							for (let i = 0; i < children.length; i++) {
								const child = children[i]?.component;
								if (child?.ctx?.compactSpaceScene) {
									found = child;
									break;
								}
							}
							if (!found) {
								console.warn('Could not find MainComponent');
								console.groupEnd();
								return;
							}
						}
						
						// In production, data is in props; in dev, it's in ctx
						const actualMainComp = mainComp || sceneManager.subTree?.children?.find(c => c?.component)?.component;
						const dataSource = actualMainComp?.ctx?.compactSpaceScene ? actualMainComp.ctx : actualMainComp?.props;
						
						if (!dataSource?.compactSpaceScene) {
							console.warn('Could not find compactSpaceScene in ctx or props');
							console.groupEnd();
							return;
						}
						
						css = dataSource.compactSpaceScene;
						const renderTarget = dataSource.renderTarget;
						controls = dataSource.controls;
						const space = css.space;
						const camera = renderTarget?.threeCamera;
						const canvas = sootElement.shadowRoot.querySelector('canvas');
						
						if (!camera || !canvas || !controls) {
							console.warn('Missing camera, canvas, or controls');
							console.groupEnd();
							return;
						}
						
						// Get Vector3 class from Three.js
						const Vector3 = camera.position.constructor;
						
						// Get views and instances
						const views = space.collections.Views;
						const instances = space.collections.Instances;
						
						// Find initial CATEGORY view
						let currentCategoryView = Object.values(views).find(v => v.parameters?.type === 'CATEGORY');
						
						if (!currentCategoryView) {
							console.warn('No CATEGORY view found');
							console.groupEnd();
							return;
						}
						
						// Mutable category instances - will be rebuilt when view changes
						let categoryInstances = {};
						let currentPropertyId = null;
						
						// Function to rebuild category instances for a given property
						function rebuildCategoryInstances(propertyId) {
							if (propertyId === currentPropertyId) {
								console.log('Same property, skipping rebuild');
								return false; // No change
							}
							
							currentPropertyId = propertyId;
							const propertyTemplate = space.root.instanceMetadataTemplate?.propertyTemplates?.[propertyId];
							const tags = propertyTemplate?.typeDefinition?.orderedTags || [];
							
							// Create tag lookup
							const tagIdToName = {};
							tags.forEach(t => tagIdToName[t.id] = t.displayName);
							
							// Rebuild category instances
							categoryInstances = {};
							for (const [instanceId, instance] of Object.entries(instances)) {
								const propValue = instance.metadata?.propertyValues?.[propertyId];
								if (!propValue) continue;
								const tagIds = propValue.tags || (propValue.tag ? [propValue.tag] : []);
								for (const tagId of tagIds) {
									const tagName = tagIdToName[tagId];
									if (!tagName) continue;
									if (!categoryInstances[tagName]) {
										categoryInstances[tagName] = { tagId, instanceIds: [] };
									}
									categoryInstances[tagName].instanceIds.push(instanceId);
								}
							}
							
							console.log(`Rebuilt categories for property ${propertyId}: found ${Object.keys(categoryInstances).length} categories`);
							console.log(categoryInstances);
							return true; // Changed
						}
						
						// Initial build
						rebuildCategoryInstances(currentCategoryView.parameters.property);
						
						// Function to compute world positions
						function computeWorldPositions() {
							const labels = [];
							
							for (const [label, data] of Object.entries(categoryInstances)) {
								const positions = [];
								for (const instanceId of data.instanceIds) {
									const pos = css.getInstancePosition(instanceId);
									if (pos) positions.push({ x: pos.x, y: pos.y, z: pos.z });
								}
								
								if (positions.length === 0) continue;
								
								const center = {
									x: positions.reduce((sum, p) => sum + p.x, 0) / positions.length,
									y: positions.reduce((sum, p) => sum + p.y, 0) / positions.length,
									z: positions.reduce((sum, p) => sum + p.z, 0) / positions.length
								};
								
								const minY = Math.min(...positions.map(p => p.y));
								const maxY = Math.max(...positions.map(p => p.y));
								
								labels.push({
									label,
									tagId: data.tagId,
									worldPos: { x: center.x, y: maxY + 1.5, z: center.z },
									center,
									instanceCount: positions.length
								});
							}
							
							// Sort by year
							labels.sort((a, b) => parseInt(a.label) - parseInt(b.label));
							return labels;
						}
						
						// Compute initial world positions
						let worldLabels = computeWorldPositions();
						console.log('Computed world positions for', worldLabels.length, 'categories');
						
						// Function to convert world to screen coordinates
						function worldToScreen(worldPos) {
							const vector = new Vector3(worldPos.x, worldPos.y, worldPos.z || 0);
							vector.project(camera);
							
							const rect = canvas.getBoundingClientRect();
							return {
								x: (vector.x * 0.5 + 0.5) * rect.width,
								y: (-vector.y * 0.5 + 0.5) * rect.height,
								visible: vector.z < 1 && vector.z > -1
							};
						}
						
						// Function to update screen positions
						function updateScreenLabels(callback) {
							const updatedLabels = worldLabels.map(label => ({
								...label,
								screenPos: worldToScreen(label.worldPos)
							}));
							screenLabels = updatedLabels;
							
							if (callback && typeof callback === 'function') {
								callback(updatedLabels);
							}
						}
						
						// Throttled version - synced to display refresh rate
						let frameScheduled = false;
						let pendingCallback = null;
						
						function throttledUpdateScreenLabels(callback) {
							if (callback) pendingCallback = callback;
							if (frameScheduled) return;
							
							frameScheduled = true;
							requestAnimationFrame(() => {
								updateScreenLabels(pendingCallback);
								frameScheduled = false;
								pendingCallback = null;
							});
						}
						
						// Initial update
						updateScreenLabels();
						
						// Listen for camera changes (throttled)
						controls.addEventListener('change', () => throttledUpdateScreenLabels());
						
						// Minimize tour on first canvas interaction
						controls.addEventListener('start', () => {
							if (tour && !tourMinimized) {
								tourMinimized = true;
							}
						});
						console.log('✅ Listening for camera changes');
												
						// Expose helper to toggle labels
						window.toggleLabels = () => {
							labelsVisible = !labelsVisible;
							console.log('Labels visible:', labelsVisible);
						};
						
						console.log('✅ Category labels set up successfully');
						console.log('Use window.toggleLabels() to show/hide labels');
						
						// Listen for layout changes to recompute label positions and categories
						sootElement.addEventListener('changeLayout', (e) => {
							const layout = e.detail?.eventData?.layout;
							
							// Check if this is a SAVED_VIEW with a CATEGORY type
							if (layout?.type === 'SAVED_VIEW' && layout.viewId) {
								const newView = views[layout.viewId];
								if (newView?.parameters?.type === 'CATEGORY') {
									// Show labels for CATEGORY views
									labelsVisible = true;
									
									setTimeout(() => {
										const newPropertyId = newView.parameters.property;
										rebuildCategoryInstances(newPropertyId);
										worldLabels = computeWorldPositions();
										throttledUpdateScreenLabels();
									}, 500);
								} else {
									// Hide labels for non-CATEGORY saved views
									labelsVisible = false;
								}
							} else {
								// Hide labels for non-saved-view layouts (e.g., search)
								labelsVisible = false;
							}
						});
						
						console.groupEnd();
						
					} catch (error) {
						console.error('❌ Error setting up category labels:', error);
						console.groupEnd();
					}
				}, 2000); // Wait for full initialization

				sootElement.addEventListener("selectInstance", async (event) => {
					instanceSelected = await sootElement?.expose?.getInstanceDetails(event.detail.eventData.instanceId);
					console.log(instanceSelected)
					showModal = true;
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
						
						// Update savedLayout if the viewId exists in viewsById
						if (layout.viewId && viewsById[layout.viewId]) {
							savedLayout = layout.viewId;
							console.log('  └─ Updated savedLayout to:', savedLayout);
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
		slug="d4758735-2d66-49bb-bbb4-3f3f4bf9085b"
	>
	<div slot="overlay-container">
	</div>
			<div slot="viewslist">
				{#if tour}
				<Header />

					<div 
						class="tour-container {tourMinimized ? 'minimized' : ''}"
						onclick={() => { if (tourMinimized) tourMinimized = false; }}
						role="button"
						tabindex="0"
						onkeydown={(e) => { if (tourMinimized && (e.key === 'Enter' || e.key === ' ')) tourMinimized = false; }}
					>
						<div class="tour-content">
							{#each tourText[tourStep].content as paragraph}
								<p>{@html paragraph.value}</p>
							{/each}
						</div>
						{#if tourStep < tourText.length - 1}
							<button class="tour-button" onclick={() => { 
								tourStep++;
								
								// animalFilter("rare"); 
							}}>
								{tourText[tourStep].section}
								<div class="tour-arrow-right">
									<ChevronRight size="30" strokeWidth="1.7" color="#000" />
								</div>	
							</button>
						{/if}
						<!-- {#if tourStep > 0}
							<button class="tour-button" onclick={() => tourStep--}>
								<div class="tour-arrow-left">
									<ChevronLeft size="15" strokeWidth="1.2" color="#000" />
								</div>
							</button>
						{/if} -->
						{#if tourMinimized}
							<div class="tour-tab">TAP/CLICK TO CONTINUE TOUR</div>
						{/if}
					</div>
				{/if}
					<!-- Category Labels Overlay -->
				{#if labelsVisible && screenLabels.length > 0}
					{#key savedLayout}
						<div class="labels-overlay" transition:fade={{duration: 1000}}>
							{#each screenLabels as label (label.tagId)}
								{@const decodedLabel = decodeURIComponent(label.label)}
								{#if label.screenPos?.visible}
									<div
										class="category-label"
										style="
											left: {Math.round(label.screenPos.x)}px;
											top: {Math.round(label.screenPos.y)}px;
										"
									>
										<span class="label-text">{getLabelContent(decodedLabel)}</span>
									</div>
								{/if}
							{/each}
						</div>
					{/key}
				{/if}
				<!-- <button style="position:fixed; z-index: 10000000;" on:click={() => {
					showModal = false;
					sootElement?.expose?.deselectInstance();
				}}>
					Close focus view
				</button> -->
			
				<!-- <button style="top: 0; position:fixed; z-index: 10000000;" class="modal-button" on:click={showModal = true}>Show Modal</button> -->
				<div class="geocoder-container" style="visibility: {tourMinimized ? 'visible' : 'hidden'};" bind:this={geocoderContainer}>
					{#if citiesList}
						<div class="filter-container">
							{#if activeFilter}
								<!-- Show active filter with X button -->
								<button class="filter-button active-filter" onclick={clearFilter}>
									{activeFilter.label} <span class="clear-x">×</span>
								</button>
							{:else}
								<!-- Showfind all filter buttons -->
								{#each highlightedGeographies as city}
									<button class="filter-button" onclick={() => filter(city)}>{city}</button>
								{/each}
								<div class="divider"></div>
								<button style="background: #1d3d64;" class="filter-button fancy-button" onclick={() => changeFilterByIndex(1)}>States</button>
								<button style="background: #1d3d64;" class="filter-button fancy-button" onclick={() => changeFilterByIndex(2)}>Menu Type</button>

								<button style="background: #1d3d64;" class="filter-button fancy-button" onclick={() => animalFilter('pretentious')}>Pretentious</button>
								<button style="background: #1d3d64;" class="filter-button fancy-button" onclick={() => animalFilter('casual')}>Casual</button>
								<button style="background: #5a1d64;" class="filter-button fancy-button" onclick={() => animalFilter('plaza')}>Plaza Hotel</button>
								<button style="background: #5a1d64;" class="filter-button fancy-button" onclick={() => animalFilter('waldorf')}>Waldorf-Astoria</button>
								<button style="background: #5a1d64;" class="filter-button fancy-button" onclick={() => animalFilter('delmonicos')}>Delmonico's</button>
								<div class="divider"></div>
								<button style="background: #32641d;" class="filter-button fancy-button" onclick={() => animalFilter('obscure')}>Obscure Dishes</button>
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
	.tour-container {
		position: fixed;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10000002;
		background: rgba(255, 255, 255, 0.95);
		-webkit-backdrop-filter: blur(1rem);
		backdrop-filter: blur(1rem);
		border-radius: 1rem 1rem 0 0;
		padding: 2rem;
		max-width: 700px;
		width: calc(100% - 100px);
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
		transition: transform 0.1s ease, opacity 0.3s ease;
	}

	.tour-container.minimized {
		transform: translateX(-50%) translateY(calc(100% - 40px));
		cursor: pointer;
	}

	.tour-container.minimized:hover {
		transform: translateX(-50%) translateY(calc(100% - 45px));
	}

	.tour-container.minimized .tour-content {
		opacity: 0;
		pointer-events: none;
	}

	.tour-content {
		transition: opacity 0.2s ease;
	}

	.tour-content h1 {
		margin: 0 0 0.5rem 0;
		font-family: 'Atlas Grotesk', sans-serif;
		font-size: 1.5rem;
		font-weight: 500;
	}

	.tour-content p {
		margin: 0;
		font-family: 'Atlas Grotesk', sans-serif;
		font-size: 1rem;
		line-height: 1.3;
		letter-spacing: -0.01em;
		color: #111;
		margin-bottom: 1rem;
	}

	.tour-tab {
		position: absolute;
		top: 8px;
		left: 50%;
		transform: translateX(-50%);
		font-family: 'Atlas Typewriter', monospace;
		font-size: 17px;
		color: #333;
		white-space: nowrap;
	}

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

	/* Category Labels Overlay */
	.labels-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 1000;
		overflow: hidden;
	}

	.category-label {
		position: absolute;
		transform: translate(-50%, -100%);
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		transition: opacity 0.15s ease;
	}

	.label-text {
		font-family: 'Atlas Typewriter', monospace;
		font-size: 11px;
		font-weight: 400;
		color: white;
		background: rgba(0, 0, 0, .9);
		padding: 3px 4px;
		border-radius: 2px;
		white-space: nowrap;
		/* box-shadow: 0 1px 3px rgba(0,0,0,0.2); */
		-webkit-font-smoothing: antialiased;
	}

	.label-count {
		font-family: 'Atlas Typewriter', monospace;
		font-size: 9px;
		color: #666;
		background: rgba(255, 255, 255, 0.7);
		padding: 1px 4px;
		border-radius: 2px;
	}

	.tour-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin: 0;
		font-size: 16px;
		display:flex;
		font-weight: 600;
		letter-spacing: -0.02em;
		justify-content:flex-end;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		align-items: center;
		width: 100%;
	}

	:global(.tour-button svg) {
		transform: translate(0,2px);
	}
</style>
