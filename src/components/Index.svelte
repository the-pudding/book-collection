<script>
	import { onMount, getContext } from "svelte";
	import { browser } from "$app/environment";
	import Modal from "$components/Modal.svelte";
	import loadCsv from "../utils/loadCsv";
	import metaData from "$data/metadata.csv";
	import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
	import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
	import arrowRight from "$svg/arrow-right.svg";
	import plus from "$svg/plus.svg";
	import minus from "$svg/minus.svg";
	import { Squirrel, Turtle, Bird, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "@lucide/svelte";
	import Header from "$components/Header.svelte";
	import { fade, slide } from "svelte/transition";
	import useWindowDimensions from "$runes/useWindowDimensions.svelte.js";

	let dimensions = new useWindowDimensions();
	let sootElement;
	let loaded = $state(false);
	let loadingImageIndex = $state(0);
	let loadingPhase = $state('loading');  // 'loading' | 'fadeImages' | 'fadeBackground' | 'done'
	let loadingVisible = $state(true);
	let metadataLookup = {};
	
	// Sample menu image IDs for loading carousel
	const loadingMenuImages = ['466953'];
	const LOADING_CYCLE_MS = 1500;
	let currentLayout = null;
	let autocompletes = [];
	let controls = $state(null);
	let css = null;  // compactSpaceScene reference for zooming
	let sootRenderer = $state(null);  // Three.js WebGLRenderer for pause/resume when modal is open
	let sootAnimationLoop = null;      // saved callback to restore after pause
	let sootRenderTarget = $state(null);  // soot's render target for monkey-patch pause when modal is open
	let lastSearchText = null;
	let searchInput = "";
	let showAutocompletes = false;
	let showModal = $state(false);
	let instanceSelected = $state(null);
	let citiesList = $state(null);
	let statesList = $state(null);
	let tourFilter = $state(null);

	let activeFilter = $state(null); // Track the currently selected filter
	/** When a search result is clicked: 'state' | 'city' | null */
	let searchClickedType = $state(null);
	let geocoderContainer;
	let geocoder;
	let lastTouchEndTime = 0;
	let lastMousedownTime = 0;
	let tour = $state(true);
	let tourMinimized = $state(false);
	let showControlsPanel = $state(false);

	// Controls tuning - adjustable via GUI
	let controlSettings = $state({
		staticMoving: true,
		dynamicDampingFactor: 0.45,
		dynamicDampingFactorWhilePanning: 0.4,
		dynamicDampingFactorWhileWheelPanning: 0.7,
		panSpeed: 0.4,
		scrollToZoomSpeed: 0.00025,
		zoomSpeed: 2.4
	});

	// Apply control panel sliders to the soot canvas orbit controls
	$effect(() => {
		if (!controls) return;
		controls.staticMoving = controlSettings.staticMoving;
		controls.dynamicDampingFactor = controlSettings.dynamicDampingFactor;
		controls.dynamicDampingFactorWhilePanning = controlSettings.dynamicDampingFactorWhilePanning;
		controls.dynamicDampingFactorWhileWheelPanning = controlSettings.dynamicDampingFactorWhileWheelPanning;
		controls.panSpeed = controlSettings.panSpeed;
		controls.scrollToZoomSpeed = controlSettings.scrollToZoomSpeed;
		controls.zoomSpeed = controlSettings.zoomSpeed;
	});

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
	

	function getCity(city) {
		let cityName = city.split(',')[0];
		if(cityName == "New York") {
			return "NYC";
		}
		if(cityName == "Los Angeles") {
			return "LA";
		}
		if(cityName == "San Francisco") {
			return "SF";
		}
		return cityName;
	}
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
	// Dispatch synthetic arrow key events so Soot's controls handle panning with smooth damping
	function panCanvas(direction) {
		const keyMap = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };
		const code = keyMap[direction];
		if (!code) return;
		const evt = new KeyboardEvent('keydown', { key: code, code, bubbles: true });
		window.dispatchEvent(evt);
	}

	// Dispatch synthetic wheel events so Soot's controls handle zooming with smooth damping
	function zoomCanvas(direction) {
		if (!controls?.domElement) return;
		const el = controls.domElement;
		const rect = el.getBoundingClientRect();
		const pageX = rect.left + rect.width / 2;
		const pageY = rect.top + rect.height / 2;
		const deltaY = direction === 'in' ? -100 : 100;
		const evt = new WheelEvent('wheel', {
			deltaY,
			deltaMode: 0,
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2,
			pageX,
			pageY,
			bubbles: true,
			cancelable: true
		});
		el.dispatchEvent(evt);
	}

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
		// filter("focus")
		
		if(tourStep === 0) {
			clearFilter();
		}

		// if (tourStep === 1) {
		// 	changeFilterByIndex(2);
		// }
		
		if(tourStep === 1) {
			// controls.maxDistance = 2.5;
			filterTag("focus")
			setTimeout(() => {
				zoomToInstance(controls, css, "21f8cf5a-2ccd-4bbd-a327-15d8099a7b1e", 600, 1, { x: -.5, y: -.4 });
				// setTimeout(() => {
				// 	controls.maxDistance = 2.5;
				// }, 1000)
			}, 1000)
		}
		if(tourStep === 2) {		
			filterTag("delmonicos");
			setTimeout(() => {
				zoomToInstance(controls, css, "8ab8f50d-05d4-43f2-8f2a-263a8d97f795", 1500, 50, { x: -.25, y: -.2 });
			}, 1000)
		}
		if(tourStep === 3) {
			if(activeFilter !== "delmonicos"){
				filterTag("delmonicos");
			}
			setTimeout(() => {
				zoomToInstance(controls, css, "8ab8f50d-05d4-43f2-8f2a-263a8d97f795", 1500, 1, { x: -.5, y: -0.4 });
			}, 3000)
		}
		if(tourStep === 4) {
			if(activeFilter !== "delmonicos"){
				filterTag("delmonicos");
			}
			setTimeout(() => {
				zoomToInstance(controls, css, "1a34bf66-40c8-4074-b78a-ebc568d68517", 1500, 1, { x: -.4, y: -0.35 });
			}, 1000)
		}
		if(tourStep === 5) {			
			filterTag("off");
			setTimeout(() => {
				zoomToInstance(controls, css, "1e54d1a5-7aa5-463f-b2c0-4d4df56dcd59", 1500, 1.5, { x: -.2, y: -0.15 });
			}, 1000)
		}
		if(tourStep === 6) {	
			if(activeFilter !== "off"){
				filterTag("off");
			}
			setTimeout(() => {
				zoomToInstance(controls, css, "d0ad029e-0858-4540-9112-f21b131a2999", 1500, 1.5, { x: -.2, y: -0.15 });
			}, 1000)
		}
		if(tourStep === 7) {		
			filterTag("hist");
			setTimeout(() => {
				zoomToInstance(controls, css, "d92dda48-e0a0-4565-b1ea-69fd4fc60e6d", 1500, 1.2, { x: -.5, y: -.5 });
			}, 1000)
		}
		if(tourStep === 8) {		
			changeFilterByIndex(2);
		}
		if(tourStep === 9) {		
			clearFilter();
		}
	});
	
	// Cycle through loading images
	$effect(() => {
		if (loaded) return;
		let idx = 0;
		const interval = setInterval(() => {
			idx = (idx + 1) % loadingMenuImages.length;
			loadingImageIndex = idx;
		}, LOADING_CYCLE_MS);
		return () => clearInterval(interval);
	});
	
	// Two-phase fade out when loaded: 1s fade images, then 1s fade background
	$effect(() => {
		if (!loaded) return;
		loadingPhase = 'fadeImages';
		const t1 = setTimeout(() => {
			loadingPhase = 'done';
			loadingVisible = false;
		}, 1000);
		return () => {
			clearTimeout(t1);
		};
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
		} else if (typeof instanceSelected === 'object' && instanceSelected.id) {
			// Object from getInstanceDetails() - the id might be a SOOT UUID
			// We need to extract the actual NYPL image ID from metadata
			imageId = instanceSelected.editableMetadata.fileName.replace(".jpg", "");
		}
		
		// Try to get related images using the instance ID
		const related = getRelatedImageIds(imageId);
		
		return related;
	});

	// Expose sootElement to window for console access
	$effect(() => {
		if (browser && sootElement) {
			window.sootElement = sootElement;
		}
	});

	// Pause soot's Three.js render loop when modal is open so DeckGL isn't competing for GPU
	$effect(() => {
		const modalOpen = showModal;
		const renderer = sootRenderer;
		const renderTarget = sootRenderTarget;
		const ctrls = controls;

		// Fallback: monkey-patch renderTarget.render to no-op when modal open (soot uses its own loop, not setAnimationLoop)
		if (renderTarget && typeof renderTarget.render === 'function') {
			if (modalOpen) {
				if (!renderTarget._originalRender) {
					renderTarget._originalRender = renderTarget.render.bind(renderTarget);
					renderTarget.render = () => {};
					console.log("monkey-patching renderTarget.render",renderTarget)
				}
				if (ctrls && 'enabled' in ctrls) ctrls.enabled = false;
			} else {
				if (renderTarget._originalRender) {
					renderTarget.render = renderTarget._originalRender;
					delete renderTarget._originalRender;
				}
				if (ctrls && 'enabled' in ctrls) ctrls.enabled = true;
			}
			return;
		}
	});

	// Initialize geocoder when container and citiesList are ready
	$effect(() => {
		const hasContainer = !!geocoderContainer;
		const citiesLen = citiesList?.length ?? 0;
		const statesLen = statesList?.length ?? 0;
		if (!geocoderContainer) {
			console.log('[Geocoder suggest] suggest wont fire: no geocoderContainer (element not mounted yet)');
			return;
		}
		if (!citiesList || citiesList.length === 0) {
			console.log('[Geocoder suggest] suggest wont fire: citiesList empty or null');
			return;
		}
		if (!statesList || statesList.length === 0) {
			console.log('[Geocoder suggest] suggest wont fire: statesList empty or null');
			return;
		}
		setTimeout(() => {
			initializeGeocoder(citiesList, statesList);
		}, 100);
	});

	async function restFilter(rest){
		console.log('[Search debug] restFilter called', rest);
		activeFilter = rest;
		tourFilter = rest;
		searchClickedType = "rest";
		// activeFilter = { raw: rest, label: rest };
		await sootElement?.expose?.executeSearch(rest);
	}

	async function rareFilter(rare){
		console.log('[Search debug] rareFilter called', rare);
		activeFilter = "rare";
		tourFilter = rare;
		searchClickedType = "rare";
		// activeFilter = { raw: rare, label: rare };
		await sootElement?.expose?.executeSearch(rare);
	}

	async function animalFilter(animal){
		console.log('[Search debug] animalFilter called', animal);
		activeFilter = animal;
		searchClickedType = animal;

		await sootElement?.expose?.executeSearch(animal);
	}

	async function filtergeoCoderLocation(tag){
		console.log('[Search debug] filterTag called', tag);
		
		tourFilter = tag;

		const decoded = (() => {
			try { return decodeURIComponent(tag); } catch { return tag; }
		})();
		const encodedLocation = encodeURIComponent(decoded);

		if(encodedLocation === "New%20York%2C%20NY") {
			searchClickedType = "state";
			activeFilter = "New%20York";
			await sootElement?.expose?.executeSearch("New%20York");
		} else {
			console.log(encodedLocation)
			activeFilter = encodedLocation;
			searchClickedType = "geography_city";
			await sootElement?.expose?.executeSearch(encodedLocation);
		}
	}

	async function filterTag(tag){
		if(tag == "focus") {
			searchClickedType = "tags";
		} else if(tag == "delmonicos") {
			searchClickedType = "delmonicos";
		} else if(tag == "off") {
			searchClickedType = "tags";
		} else if(tag == "hist") {
			searchClickedType = "tags";
		}
		activeFilter = tag;

		
		console.log('[Search debug] filterTag called', tag);
		tourFilter = tag;
		// activeFilter = { raw: tag, label: tag };
		await sootElement?.expose?.executeSearch(tag);
	}
	
	async function clearFilter() {
		console.log('[Search debug] clearFilter called');
		activeFilter = null;
		searchClickedType = null;
		// controls.maxDistance = 300;
		
		// Reset to default view or clear search
		const views = await sootElement?.expose?.getViews();
		if (views && views.length > 0) {
			sootElement?.expose?.setActiveView(views[0].id);
		}
	}

	function openRandomModal() {

		console.log("running openRandomModal", searchClickedType, activeFilter, tourFilter);


		if (!metaData?.length || !imageIdToMenuId.size) return;

		const safeDecode = (s) => {
			if (s == null || s === '') return '';
			try { return decodeURIComponent(s); } catch { return s; }
		};
		const tagsContain = (tagsStr, tag) => {
			if (!tagsStr || !tag) return false;
			return tagsStr.split(',').map((t) => t.trim()).includes(tag);
		};

		let rows = metaData.filter((row) => row.filename);

		if (activeFilter != null && searchClickedType) {
			const raw = typeof activeFilter === 'object' && activeFilter !== null && 'raw' in activeFilter ? activeFilter.raw : activeFilter;
			const matchValue = raw != null ? String(raw).trim() : '';
			if (matchValue) {
				const column = searchClickedType;
				rows = rows.filter((row) => (row[column] ?? '').trim() === matchValue);
			}
		}

		console.log(rows)
		// else if (tourFilter != null) {
		// 	const tour = String(tourFilter).toLowerCase();
		// 	if (tour === 'focus') {
		// 		rows = rows.filter((row) => tagsContain(row.tags, 'focus'));
		// 	} else if (tour === 'delmonicos') {
		// 		rows = rows.filter((row) => row.rest === 'delmonicos');
		// 	} else if (tour === 'off') {
		// 		rows = rows.filter((row) => tagsContain(row.tags, 'off'));
		// 	} else if (tour === 'hist') {
		// 		rows = rows.filter((row) => tagsContain(row.tags, 'hist'));
		// 	}
		// }

		const imageIds = rows
			.map((row) => row.filename.replace(/\.jpg$/i, ''))
			.filter((id) => imageIdToMenuId.has(id));
		if (imageIds.length === 0) return;
		const randomId = imageIds[Math.floor(Math.random() * imageIds.length)];
		instanceSelected = randomId;
		showModal = true;
	}

	async function changeFilterByIndex(index) {
		console.log('[Search debug] changeFilterByIndex called', index);
		const views = await sootElement?.expose?.getViews();
		console.log(views)
		if (views && views.length > 0) {
			activeFilter = views[index].displayName;
			sootElement?.expose?.setActiveView(views[index].id);
		}
	}

	function initializeGeocoder(cities, states) {
		console.log('[Geocoder suggest] initializeGeocoder called', { citiesCount: cities?.length, statesCount: states?.length });
		if (!geocoderContainer || !cities || cities.length === 0 || !states || states.length === 0) {
			console.log('[Geocoder suggest] initializeGeocoder early return (missing container or data)');
			return;
		}

		// Clean up existing geocoder if any (remove DOM only; .off() requires listener ref so we don't call it)
		if (geocoder) {
			console.log('[Search debug] initializeGeocoder cleaning up existing geocoder (re-init)');
			const geocoderElement = geocoderContainer.querySelector('.mapboxgl-ctrl-geocoder');
			if (geocoderElement) {
				geocoderElement.remove();
			}
		}
		// Create local geocoder function for autocomplete
		const decodeDisplay = (s) => {
			try { return decodeURIComponent(s); } catch { return s; }
		};

		// Geocoder uses only citiesList and statesList - no other sources
		const localGeocoder = (query) => {
			console.log('[Geocoder suggest] localGeocoder CALLED', { query: query ?? '(null)', type: typeof query });
			const queryLower = (query || '').toLowerCase().trim();
			if (!queryLower) {
				console.log('[Geocoder suggest] localGeocoder returning [] - empty query (focus/clear or whitespace only)');
				return [];
			}
			const cityMatches = cities
				.filter(city => city.toLowerCase().includes(queryLower) || decodeDisplay(city).toLowerCase().includes(queryLower))
				.slice(0, 3)
				.map(city => ({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [0, 0] },
					place_name: decodeDisplay(city),
					properties: { location: city }
				}));

			const stateMatches = (states || [])
				.filter(state => state.toLowerCase().includes(queryLower) || decodeDisplay(state).toLowerCase().includes(queryLower))
				.slice(0, 2)
				.map(state => ({
					type: 'Feature',
					geometry: { type: 'Point', coordinates: [0, 0] },
					place_name: decodeDisplay(state),
					properties: { location: state }
				}));

			const results = [...cityMatches, ...stateMatches];
			if (results.length === 0) {
				console.log('[Geocoder suggest] localGeocoder returning [] - no city or state matches for', JSON.stringify(queryLower), '| cities sample:', cities.slice(0, 3).map(decodeDisplay), '| states sample:', (states || []).slice(0, 3).map(decodeDisplay));
			} else {
				console.log('[Geocoder suggest] localGeocoder returning', results.length, 'results', results.map(r => r.place_name));
			}
			return results;
		};

		// Initialize Mapbox Geocoder with localGeocoder for autocomplete
		// accessToken required: library still calls Mapbox events API. Use VITE_MAPBOX_ACCESS_TOKEN in .env (pk.* token is public; restrict it in Mapbox dashboard by URL).
		const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ?? '';
		geocoder = new MapboxGeocoder({
			accessToken: mapboxToken,
			localGeocoder: localGeocoder,
			localGeocoderOnly: true, // ONLY use local geocoder, exclude all Mapbox API results
			placeholder: 'Search cities, states...',
			externalGeocoder: false, // Disable Mapbox geocoding API
			marker: false,
			zoom: 0,
			minLength: 0, // Show suggestions immediately
			limit: 5, // Limit number of suggestions
			render: (item) => {
				const name = (item.place_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
				return `<div class="mapboxgl-ctrl-geocoder--suggestion"><div class="mapboxgl-ctrl-geocoder--suggestion-title">${name}</div></div>`;
			}
		});

		// Handle result selection
		geocoder.on('result', (e) => {
			console.log('[Search debug] geocoder "result" event (user selected suggestion)', e.result?.place_name);
			const result = e.result;
			if (result.properties?.location) {
				const location = result.properties.location;
				searchClickedType = (states || []).includes(location) ? 'state' : 'geography_city';
				filtergeoCoderLocation(location);
			}
		});

		// Add geocoder to container
		const geocoderElement = geocoder.onAdd();
		geocoderContainer.appendChild(geocoderElement);
		
		// Valid display names (decoded) for suggestion validation
		const validDisplayNames = new Set([
			...cities.map(decodeDisplay),
			...(states || []).map(decodeDisplay)
		]);
		
		// Use MutationObserver to filter out invalid suggestions in real-time
		const suggestionsContainer = geocoderElement.querySelector('.mapboxgl-ctrl-geocoder--suggestions');
		if (!suggestionsContainer) {
			console.log('[Geocoder suggest] suggestionsContainer not found at init - Mapbox may create it on first focus; suggestions may still work');
		} else {
			const observer = new MutationObserver(() => {
				const suggestions = suggestionsContainer.querySelectorAll('.mapboxgl-ctrl-geocoder--suggestion');
				suggestions.forEach(suggestion => {
					const placeName = suggestion.textContent?.trim() || suggestion.innerText?.trim();
					if (placeName && !validDisplayNames.has(placeName)) {
						console.log('[Geocoder suggest] REMOVED suggestion (not in validDisplayNames):', JSON.stringify(placeName), '| validDisplayNames has:', validDisplayNames.has(placeName), '| size:', validDisplayNames.size);
						suggestion.remove();
					}
				});
			});
			observer.observe(suggestionsContainer, { childList: true, subtree: true });
		}
		
		// Also filter on results event as a backup
		geocoder.on('results', (e) => {
			const count = e.results?.length ?? 0;
			console.log('[Geocoder suggest] "results" event (suggestions shown)', count, 'results');
			if (count === 0) {
				console.log('[Geocoder suggest] 0 results shown - either localGeocoder was not called by Mapbox, or it returned [], or all suggestions were removed by observer');
			}
			if (e.results && Array.isArray(e.results)) {
				const invalidCount = e.results.filter(result => {
					const placeName = result.place_name;
					return placeName && !validDisplayNames.has(placeName);
				}).length;
				
				if (invalidCount > 0) {
					console.log('[Geocoder suggest] results event: removing', invalidCount, 'invalid suggestions (not in validDisplayNames)');
					setTimeout(() => {
						const suggestions = geocoderElement.querySelectorAll('.mapboxgl-ctrl-geocoder--suggestion');
						suggestions.forEach(suggestion => {
							const placeName = suggestion.textContent?.trim() || suggestion.innerText?.trim();
							if (placeName && !validDisplayNames.has(placeName)) {
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
							if (row.geography_city && row.geography_city.trim() !== '') {
								citiesSet.add(row.geography_city.trim());
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
					// Error loading menu data
				}
			})();

			sootElement.addEventListener('loadComplete', async (e) => {
				const views = await sootElement?.expose?.getViews();
				loaded = true;

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
							const searchAllProperties = (obj, depth = 0, maxDepth = 5) => {
								if (depth > maxDepth || !obj || typeof obj !== 'object') return null;
								
								// Check if this object has controls
								if (obj.controls && obj.smoothZoomMode !== undefined) {
									return obj.controls;
								}
								if (obj.smoothZoomMode !== undefined && typeof obj.setSmoothZoomMode === 'function') {
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
							try {
								// Some Vue components expose internal state
								const exposeKeys = Object.keys(sootElement.expose);
								// Check if there's a controls or getControls method
								for (const key of exposeKeys) {
									if (key.toLowerCase().includes('control')) {
										const val = sootElement.expose[key];
										if (val && val.smoothZoomMode !== undefined) {
											controls = val;
											break;
										}
									}
								}
							} catch (e) {
								// Error checking expose
							}
						}
						
						if (controls) {
							controls.minDistance = .5;
							controls.maxDistance = 300;

							if(dimensions.width > 800) {
								controls.smoothZoomMode = 'SCROLL_TO_ZOOM';
								controls.dynamicDampingFactor = .4;
								controls.dynamicDampingFactorWhilePanning = .9;
								controls.dynamicDampingFactorWhileWheelPanning = .7;
								controls.panSpeed = .3;
								controls.scrollToZoomSpeed = 0.00040;
								controls.zoomSpeed = 2;
								controls.staticMoving = false;
							}
							// Tuning params applied via $effect from controlSettings
						}
					} catch (error) {
						// Error enabling zoom-on-scroll
					}
				}, 500); // Longer delay to ensure component tree is fully built

				setTimeout(() => {
					try {
						// Use _instance which is available in both dev and production
						const rootComp = sootElement._instance;
						if (!rootComp) {
							return;
						}
						
						// Navigate: SootPublication -> SceneManager -> MainComponent
						const sceneManager = rootComp.subTree?.children?.[0]?.component;
						if (!sceneManager) {
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
								return;
							}
						}
						
						// In production, data is in props; in dev, it's in ctx
						const actualMainComp = mainComp || sceneManager.subTree?.children?.find(c => c?.component)?.component;
						const dataSource = actualMainComp?.ctx?.compactSpaceScene ? actualMainComp.ctx : actualMainComp?.props;
						
						if (!dataSource?.compactSpaceScene) {
							return;
						}
						
						css = dataSource.compactSpaceScene;
						console.log(actualMainComp)
						const renderTarget = dataSource.renderTarget;
						sootRenderTarget = renderTarget;
						controls = dataSource.controls;
						// Capture Three.js WebGLRenderer for pause/resume when modal is open (setAnimationLoop(null) / setAnimationLoop(callback))
						const r = dataSource.renderer ?? renderTarget?.renderer ?? (typeof renderTarget?.setAnimationLoop === 'function' ? renderTarget : null);
						if (r && typeof r.setAnimationLoop === 'function') {
							sootRenderer = r;
						}
						const space = css.space;
						const camera = renderTarget?.threeCamera;
						const canvas = sootElement.shadowRoot.querySelector('canvas');
						
						if (!camera || !canvas || !controls) {
							return;
						}
						
						// Get Vector3 class from Three.js
						const Vector3 = camera.position.constructor;
						
						// Get views and instances
						const views = space.collections.Views;
						const instances = space.collections.Instances;
						const viewList = Object.values(views);
						
						// Use the actually active view (savedLayout) for initial labels; fallback to first CATEGORY only if not set
						const activeViewId = savedLayout;
						const activeView = activeViewId && (views[activeViewId] ?? viewList.find(v => v.id === activeViewId));
						let currentCategoryView =
							activeView?.parameters?.type === 'CATEGORY' ? activeView
							: viewList.find(v => v.parameters?.type === 'CATEGORY') ?? null;
						
						if (!currentCategoryView) {
							return;
						}
						
						// Mutable category instances - will be rebuilt when view changes
						let categoryInstances = {};
						let currentPropertyId = null;
						
						// Function to rebuild category instances for a given property
						function rebuildCategoryInstances(propertyId) {
							if (propertyId === currentPropertyId) {
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
							
							return true; // Changed
						}
						
						// No initial build here: wait for changeLayout so we use the view soot actually applied (avoids wrong view on load)
						
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
						
						// Fallback: if changeLayout never fired (e.g. soot doesn't emit on initial load), build from savedLayout after a delay
						setTimeout(() => {
							if (currentPropertyId !== null) return; // already built from changeLayout
							const fallbackView = savedLayout && (views[savedLayout] ?? viewList.find(v => v.id === savedLayout));
							if (fallbackView?.parameters?.type === 'CATEGORY') {
								currentCategoryView = fallbackView;
								rebuildCategoryInstances(fallbackView.parameters.property);
								worldLabels = computeWorldPositions();
								throttledUpdateScreenLabels();
							}
						}, 3500);
						
						// Minimize tour on first canvas interaction
						controls.addEventListener('start', () => {
							if (tour && !tourMinimized) {
								tourMinimized = true;
							}
						});
												
						// Expose helper to toggle labels
						window.toggleLabels = () => {
							labelsVisible = !labelsVisible;
						};
						
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
										currentCategoryView = newView;
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
						
					} catch (error) {
						// Error setting up category labels
					}
				}, 2000); // Wait for full initialization

				// Only show modal for intentional pointer actions; avoid false triggers from scroll-release or stray touches
				window.addEventListener('touchend', () => {
					lastTouchEndTime = Date.now();
				}, { passive: true });
				window.addEventListener('mousedown', () => {
					lastMousedownTime = Date.now();
				}, { passive: true });

				sootElement.addEventListener("selectInstance", async (event) => {
					const now = Date.now();
					const timeSinceTouchend = now - lastTouchEndTime;
					const timeSinceMousedown = now - lastMousedownTime;

					// Desktop: selection within 300ms of mousedown = intentional click
					const fromMouse = timeSinceMousedown < 300;
					// Mobile: selection 80–400ms after touchend = intentional tap (avoid <80ms scroll-release, ignore stale >400ms)
					const fromTouchIntentional = timeSinceTouchend >= 80 && timeSinceTouchend < 400;

					if (fromMouse || fromTouchIntentional) {
						instanceSelected = await sootElement?.expose?.getInstanceDetails(event.detail.eventData.instanceId);
						console.log(instanceSelected);
						showModal = true;
					}
				}, true);
				
				sootElement.addEventListener('changeLayout', (e) => {
					const layout = e.detail.eventData.layout;

					if (layout.type === 'SAVED_VIEW') {
						// Update savedLayout if the viewId exists in viewsById
						if (layout.viewId && viewsById[layout.viewId]) {
							savedLayout = layout.viewId;
						}
					} else if (layout.type === 'SEARCH') {
						if (layout.query.type === 'TEXT') {
							lastSearchText = layout.query.text;
						} else if (layout.query.type === 'SEE_SIMILAR') {
							lastSearchText = 'Similar to image';
						} else if (layout.query.type === 'FILTER_TO_TAG') {
							lastSearchText = 'Filtered to tag';
						} else if (layout.query.type === 'METADATA_SEARCH') {
							lastSearchText = 'Metadata search';
						}
					}

					currentLayout = layout;
				});

			});
			
		}
	});
</script>


<svelte:boundary onerror={() => {}}>



	{#if loadingVisible}
		<Header />
		<div transition:fade={{duration: 300}} class="loading-container">
			<p>Loading...</p>
			{#if dimensions.width >= 450}
				<div class="loading-carousel">
					<img 
					class="loading-menu-image"
					src="assets/loading.webp"
					alt="Loading menu"
					transition:fade={{duration: 300}}
					/>
				</div>
			{:else if dimensions.width > 0}
				<img 
				class="loading-menu-image"
				src="https://s3.us-east-1.amazonaws.com/pudding.cool/menu-images/{loadingMenuImages[loadingImageIndex]}.jpg"
				alt="Loading menu"
				transition:fade={{duration: 300}}
				/>
			{/if}
		</div>
	{/if}

	<div class="modal-container {showModal ? 'show-modal' : 'hide-modal'}">
		<Modal bind:showModal {instanceSelected} relatedMetadata={relatedImageIds[1]} relatedImageIds={relatedImageIds[0]} {sootElement} {aspectRatioMap} {activeFilter} {tourFilter} {metaData} onOpenRandom={openRandomModal} {dimensions} />
	</div>

	<div id="soot-publication" class="{showModal ? 'soot-publication-hide' : 'soot-publication-show'}">
	

	
	<soot-publication
		bind:this={sootElement}
		slug="2bb935d1-b350-4915-b4f6-e20a4dcace91"
	>
		<div slot="overlay-container">
		</div>
	

			<div slot="viewslist">
				<Header />

				{#if tour && loaded}

				

					<div 
						class="tour-container {tourMinimized ? 'minimized' : ''}"
						onclick={() => { if (tourMinimized) tourMinimized = false; }}
						role="button"
						tabindex="0"
						onkeydown={(e) => { if (tourMinimized && (e.key === 'Enter' || e.key === ' ')) tourMinimized = false; }}
					>
						{#key tourStep}
							<div class="tour-content" in:fade={{duration: 600}}>
								{#each tourText[tourStep].content as paragraph}
									<p>{@html paragraph.value}</p>
								{/each}
							</div>
						{/key}
						<div class="tour-buttons">
							{#if tourStep > 0}
								<button class="tour-button tour-button-back" onclick={() => tourStep--}>
									<div class="tour-arrow-left">
										<div style="transform: rotate(180deg);">
											{@html arrowRight}
										</div>
										<!-- <ChevronLeft size="30" strokeWidth="1.7" color="#000" /> -->
									</div>
									<!-- {tourText[tourStep - 1].section} -->
								</button>
							{/if}
							{#if tourStep < tourText.length - 1}
								<button class="tour-button" style="text-align: right; margin-inline-start: auto;" onclick={() => tourStep++}>
									{tourText[tourStep].section}
									<div class="tour-arrow-right">
										{@html arrowRight}
										<!-- <ChevronRight size="30" strokeWidth="1.7" color="#000" /> -->
									</div>	
								</button>
							{/if}
							{#if tourStep == tourText.length - 1}
								<button class="tour-button" style="margin-inline-start: auto;" onclick={(e) => { e.stopPropagation(); tourMinimized = true; }}>
									Got it!
								</button>
							{/if}
						</div>
						{#if tourMinimized}
							<div class="tour-tab">Show Guide
								<span style="
									transform: rotate(-90deg);
									display: block;
									width: 18px;
									margin-left: 10px;
								">
									{@html arrowRight}
								</span>
							</div>
						{/if}
					</div>
				{/if}

				{#if loaded}
					<div class="pan-zoom-buttons">
						<div class="pan-buttons">
							<div class="pan-row pan-row-top">
								<button class="pan-btn" onclick={() => panCanvas('up')} title="Pan up">
									<div style="transform: rotate(-90deg);">
										{@html arrowRight}
									</div>
								</button>
							</div>
							<div class="pan-row">
								<button class="pan-btn" onclick={() => panCanvas('left')} title="Pan left">
									<div style="transform: rotate(180deg);">
										{@html arrowRight}
									</div>
								</button>
								<button class="pan-btn" onclick={() => panCanvas('down')} title="Pan down">
									<div style="transform: rotate(90deg);">
										{@html arrowRight}
									</div>
								</button>
								<button class="pan-btn" onclick={() => panCanvas('right')} title="Pan right">
									<div style="transform: rotate(0deg);">
										{@html arrowRight}
									</div>
								</button>
							</div>
						</div>
						<div class="zoom-buttons">
							<button class="pan-btn" onclick={() => zoomCanvas('in')} title="Zoom in">
								{@html plus}
							</button>
							<button class="pan-btn" onclick={() => zoomCanvas('out')} title="Zoom out">
								{@html minus}
							</button>
						</div>
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
				<!-- Controls tuning panel -->
				{#if loaded}
					<div class="controls-area">
						<div class="title-text">5,000 menus from 1880-1920</div>
						<button 
							class="controls-panel-toggle"
							onclick={() => showControlsPanel = !showControlsPanel}
							title="Pan/zoom settings"
						>
							{showControlsPanel ? '▼' : '⚙'}
						</button>
						{#if showControlsPanel}
							<div class="controls-panel">
							<h4>Pan/Zoom Tuning</h4>
							<label class="toggle-row">
								<span>staticMoving (instant)</span>
								<button 
									class="toggle-btn {controlSettings.staticMoving ? 'on' : 'off'}"
									onclick={() => controlSettings.staticMoving = !controlSettings.staticMoving}
								>
									{controlSettings.staticMoving ? 'ON' : 'OFF'}
								</button>
							</label>
							<label>
								dynamicDampingFactor: {controlSettings.dynamicDampingFactor.toFixed(2)}
								<input type="range" min="0" max="1" step="0.05" value={controlSettings.dynamicDampingFactor} oninput={(e) => controlSettings.dynamicDampingFactor = parseFloat(e.target.value)} />
							</label>
							<label>
								dynamicDampingFactorWhilePanning: {controlSettings.dynamicDampingFactorWhilePanning.toFixed(2)}
								<input type="range" min="0" max="1" step="0.05" value={controlSettings.dynamicDampingFactorWhilePanning} oninput={(e) => controlSettings.dynamicDampingFactorWhilePanning = parseFloat(e.target.value)} />
							</label>
							<label>
								dynamicDampingFactorWhileWheelPanning: {controlSettings.dynamicDampingFactorWhileWheelPanning.toFixed(2)}
								<input type="range" min="0" max="1" step="0.05" value={controlSettings.dynamicDampingFactorWhileWheelPanning} oninput={(e) => controlSettings.dynamicDampingFactorWhileWheelPanning = parseFloat(e.target.value)} />
							</label>
							<label>
								panSpeed: {controlSettings.panSpeed.toFixed(2)}
								<input type="range" min="0.1" max="2" step="0.05" value={controlSettings.panSpeed} oninput={(e) => controlSettings.panSpeed = parseFloat(e.target.value)} />
							</label>
							<label>
								scrollToZoomSpeed: {controlSettings.scrollToZoomSpeed.toFixed(5)}
								<input type="range" min="0.00005" max="0.001" step="0.00005" value={controlSettings.scrollToZoomSpeed} oninput={(e) => controlSettings.scrollToZoomSpeed = parseFloat(e.target.value)} />
							</label>
							<label>
								zoomSpeed: {controlSettings.zoomSpeed.toFixed(2)}
								<input type="range" min="0.5" max="5" step="0.1" value={controlSettings.zoomSpeed} oninput={(e) => controlSettings.zoomSpeed = parseFloat(e.target.value)} />
							</label>
							<button class="controls-reset" onclick={() => {
								controlSettings = {
									staticMoving: true,
									dynamicDampingFactor: 0.45,
									dynamicDampingFactorWhilePanning: 0.4,
									dynamicDampingFactorWhileWheelPanning: 0.7,
									panSpeed: 0.4,
									scrollToZoomSpeed: 0.00025,
									zoomSpeed: 2.4
								};
							}}>Reset</button>
							</div>
						{/if}
					</div>
				{/if}

				<div class="geocoder-container" style="visibility: {tourMinimized ? 'visible' : 'hidden'};" bind:this={geocoderContainer}>
					{#if citiesList}
						<div class="filter-container">
							{#if activeFilter}
								<!-- Show active filter with X button -->
								<button class="filter-button active-filter" onclick={clearFilter}>
									{decodeURIComponent(activeFilter)} <span class="clear-x">×</span>
								</button>
							{:else}
								<!-- Showfind all filter buttons -->
								{#each highlightedGeographies as city}
										<button class="filter-button"
											onclick={() => {
												searchClickedType = "geography_city";
												filtergeoCoderLocation(city);
											}}
										>
											{getCity(city)}
										</button>
								{/each}
								<div class="divider"></div>
								<button style="" class="filter-button fancy-button" onclick={() => changeFilterByIndex(1)}>States</button>
								<button style="" class="filter-button fancy-button" onclick={() => changeFilterByIndex(2)}>Menu Setting</button>

								<!-- <button style="background: #1d3d64;" class="filter-button fancy-button" onclick={() => animalFilter('pretentious')}>Pretentious</button>
								<button style="background: #1d3d64;" class="filter-button fancy-button" onclick={() => animalFilter('casual')}>Casual</button> -->
								<button style="" class="filter-button fancy-button" onclick={() => restFilter('plaza')}>Plaza Hotel</button>
								<button style="" class="filter-button fancy-button" onclick={() => restFilter('waldorf')}>Waldorf-Astoria</button>
								<button style="" class="filter-button fancy-button" onclick={() => restFilter('delmonicos')}>Delmonico's</button>
								<div class="divider"></div>
								<!-- <button style="background: #32641d;" class="filter-button fancy-button" onclick={() => animalFilter('obscure')}>Obscure Dishes</button> -->
								<button style="" class="filter-button mobile-hide fancy-button" onclick={() => rareFilter('rare')}>Uncommon Meats</button>
								<button style="" class="filter-button mobile-hide fancy-button" onclick={() => animalFilter('squirrel')}><Squirrel size="20" strokeWidth="1.5" color="#000"/></button>
								<button style="" class="filter-button mobile-hide fancy-button" onclick={() => animalFilter('turtle')}><Turtle size="20" strokeWidth="1.5" color="#000"/></button>
								<button style="" class="filter-button mobile-hide fancy-button" onclick={() => animalFilter('birdie')}><Bird size="20" strokeWidth="1.5" color="#000"/></button>
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
		bottom: -2px;
		left: 50%;
		transform: translateX(-50%);
		z-index: 10000002;
		background: rgba(255, 255, 255, 1);
		border-radius: 3px;
		padding: 20px 25px;
		padding-bottom: 15px;
		max-width: 800px;
		width: calc(100% - 20px);
		/* box-shadow: 0 -3px 7px 5px rgba(0, 0, 0, 0.1); */
		/* transition: transform 0.1s ease, opacity 0.3s ease; */
		background: #FFFFFB;
		border: 1px solid rgba(0,0,0,.10);
		/* border: 1px solid rgba(84, 84, 84, .43); */
	}

	.tour-container.minimized {
		transform: translateX(-50%) translateY(calc(100% - 40px));
		cursor: pointer;
		background: black;
		max-width: 300px;
	}

	.tour-container.minimized .tour-tab {
		color: white;
	}

	.tour-container.minimized .tour-tab :global(path) {
		color: white;
		fill: white;
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
		font-family: 'EB Garamond', sans-serif;
		font-size: 1.5rem;
		font-weight: 500;
	}

	.tour-content p {
		margin: 0;
		font-family: 'EB Garamond', sans-serif;
		color: #111;
		margin-bottom: 10px;
		font-size: 20px;
		line-height: 1.2;
		/* letter-spacing: -0.01em; */
	}

	.tour-content p:last-child {
		margin-bottom: 0;
	}

	.tour-tab {
		position: absolute;
		top: 8px;
		left: 50%;
		display: flex;
		transform: translateX(-50%);
		font-family: 'Atlas Grotesk', monospace;
		font-size: 16px;
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
		top: 50px;
		left: 10px;
		width: 300px;
		z-index: 10000001;
		display: flex;
		flex-direction: column-reverse;
		gap: 10px;
		border-radius: .2rem;
		padding: 1rem;
		overflow: visible;
	}
	.geocoder-container::after {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--color-bg);
		border-radius: .2rem;
		z-index: -1;
		pointer-events: none;
	}

	.geocoder-container :global(.mapboxgl-ctrl-geocoder) {
		width: 100%;
		/* box-shadow: 0 2px 4px rgba(0,0,0,0.2); */
		box-shadow: none;
	}

	.geocoder-container :global(.mapboxgl-ctrl-geocoder input) {
		font-family: 'EB Garamond';
		font-weight: 300;
		-webkit-font-smoothing: antialiased;
		padding-top: 0;
		padding-bottom: 0;
		background: var(--color-bg);
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
		font-family: 'EB Garamond';
		font-weight: 700;
		-webkit-font-smoothing: antialiased;
		border-radius: 1px;
		background: none;
		border: 1px solid #6a6a6a;
		color: black;
		border-right: 2px solid black;
		border-bottom: 2px solid black;
	}

	.filter-button button:hover {
		background: #fffef3;
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

	/* Controls tuning panel */
	.controls-area {
		position: fixed;
		top: 10px;
		right: 10px;
		z-index: 10000004;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.title-text {
		font-family: 'EB Garamond', sans-serif;
		font-size: 18px;
		line-height: 1.1;
		font-weight: 600;
		color: #333;
		text-align: center;
		/* white-space: nowrap; */
		padding: 0;
		width: 130px;
		margin: 0;
		margin-bottom: 7px;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
	}
	.controls-panel-toggle {
		width: 36px;
		height: 36px;
		border-radius: 6px;
		border: 1px solid rgba(0,0,0,0.2);
		background: rgba(255,255,255,0.9);
		cursor: pointer;
		font-size: 18px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		/* display: none; */
	}
	.controls-panel-toggle:hover {
		background: rgba(255,255,255,1);
	}
	.controls-panel {
		width: 320px;
		max-height: 80vh;
		overflow-y: auto;
		background: rgba(255,255,255,0.98);
		border-radius: 8px;
		border: 1px solid rgba(0,0,0,0.15);
		box-shadow: 0 4px 20px rgba(0,0,0,0.15);
		padding: 1rem 1.25rem;
		font-family: 'EB Garamond', monospace;
		font-size: 12px;
	}
	.controls-panel h4 {
		margin: 0 0 0.75rem 0;
		font-size: 13px;
	}
	.controls-panel label {
		display: block;
		margin-bottom: 0.75rem;
	}
	.controls-panel label input[type="range"] {
		display: block;
		width: 100%;
		margin-top: 0.25rem;
	}
	.controls-panel .toggle-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.controls-panel .toggle-btn {
		padding: 0.25rem 0.6rem;
		font-size: 11px;
		font-weight: 600;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
		min-width: 44px;
	}
	.controls-panel .toggle-btn.on {
		background: #333;
		color: white;
		border-color: #333;
	}
	.controls-panel .toggle-btn.off {
		background: #f0f0f0;
		color: #666;
	}
	.pan-zoom-buttons {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		position: fixed;
    	right: 22px;
    	top: 70px;
	}
	.pan-buttons {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		margin-bottom: 5px;
		padding-bottom: 7px;
		border-bottom: 1px solid #ccc;
	}
	.pan-row {
		display: flex;
		justify-content: center;
		gap: 4px;
	}
	.zoom-buttons {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.pan-btn {
		width: 32px;
		height: 32px;
		border: 1px solid rgba(0,0,0,0.62);
    	background: #fff;
		cursor: pointer;
		font-size: 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}
	.pan-btn::after {
		content: '';
		position: absolute;
		inset: 2px -4px -4px 2px;
		border-radius: 6px;
		background: repeating-linear-gradient(
			227deg,
			transparent,
			transparent 2px,
			rgba(0,0,0,0.25) 2px,
			rgba(0,0,0,0.25) 3px
		);
		z-index: -1;
	}
	.geocoder-container::before {
		content: '';
		position: absolute;
		top: 6px;
		left: 6px;
		right: -6px;
		bottom: -6px;
		border-radius: .2rem;
		background: repeating-linear-gradient(
			227deg,
			transparent,
			transparent 2px,
			rgba(0,0,0,0.25) 2px,
			rgba(0,0,0,0.25) 3px
		);
		z-index: -2;
	}
	.pan-btn:hover {
		background: rgba(255,255,255,1);
	}
	.controls-reset {
		margin-top: 0.75rem;
		padding: 0.35rem 0.75rem;
		font-size: 11px;
		cursor: pointer;
		background: #333;
		color: white;
		border: none;
		border-radius: 4px;
	}

	/* When modal is open, hide soot so it doesn't compete with DeckGL.
	   Do NOT use display: none here: it makes soot's container 0×0, soot's ResizeObserver
	   fires, and soot re-initializes/refetches (many GETs to static.soot.com) → ERR_INSUFFICIENT_RESOURCES.
	   Keeping dimensions with visibility + pointer-events avoids that. */
	.soot-publication-hide {
		visibility: hidden;
		pointer-events: none;
		/* content-visibility: hidden; */
		/* opacity: 0; */
		/* transform: translate3d(-9999px, -9999px, 0); */
	}
	.soot-publication-show {
	}
	.hide {
		display: none;
	}
	.hide-modal {
		/* visibility: hidden; */
	}

	:global(.hide-modal .random-button) {
		display: none;
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

	/* Loading state */
	.loading-container {
		position: fixed;
		inset: 0;
		z-index: 10000003;
		display: flex;
		font-family: 'EB Garamond', monospace;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		background: rgba(255, 255, 255, .5);
		-webkit-backdrop-filter: blur(0.5rem);
		backdrop-filter: blur(0.5rem);
		transition: opacity 1s ease-out;
	}
	
	.loading-container.loading-fade-images .loading-carousel {
		opacity: 0;
		transition: opacity 1s ease-out;
	}
	
	.loading-container.loading-fade-background {
		opacity: 0;
	}

	.loading-container p {
		font-family: 'Atlas Grotesk', monospace;
		font-size: 18px;
		font-weight: 600;
		color: black;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}
	
	.loading-carousel {
		display: flex;
		align-items: center;
		justify-content: center;
		width: min(90vw, 900px);
		height: min(80vh, 500px);
		transition: opacity 1s ease-out;
	}
	
	.loading-menu-image {
		max-width: 100%;
		/* max-height: 100%; */
		/* object-fit: contain; */
		/* box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12); */
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
		font-family: 'Atlas Grotesk', monospace;
		font-size: 11px;
		font-weight: 600;
		color: white;
		background: rgba(0, 0, 0, .9);
		padding: 3px 4px;
		border-radius: 2px;
		white-space: nowrap;
		/* box-shadow: 0 1px 3px rgba(0,0,0,0.2); */
		-webkit-font-smoothing: antialiased;
	}

	.label-count {
		font-family: 'EB Garamond', monospace;
		font-size: 9px;
		color: #666;
		background: rgba(255, 255, 255, 0.7);
		padding: 1px 4px;
		border-radius: 2px;
	}

	.tour-buttons {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		width: 100%;
	}

	.tour-button {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
		margin: 0;
		font-size: 15px;
		font-family: 'Atlas Grotesk', monospace;
		display: flex;
		font-weight: 600;
		letter-spacing: -0.02em;
		justify-content: flex-end;
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		align-items: center;
		padding-top: 1rem;
		/* flex: 1; */
	}

	.tour-button-back {
		justify-content: flex-start;
	}

	:global(.tour-button svg) {
		transform: translate(0,2px);
	}

	.tour-arrow-right {
		margin-right: -9px;
		margin-left: 7px;
	}

	@media (max-width: 450px) {
		.mobile-hide {
			display: none;
		}
		.tour-container {
			padding: 20px 15px;
			padding-bottom: 10px;
			max-width: 800px;
			width: calc(100% - 20px);
			letter-spacing: 0em;
			padding-top: 10px;
		}

		.tour-content p {
			font-size: 18px;
		}

		.tour-button {
			font-size: 15px;
		}
		.pan-zoom-buttons {
			right: 10px;
			position: fixed;
			top: 45px;
			z-index: 1000000000;
		}
		.zoom-buttons {
			flex-direction: column;
		}
		.geocoder-container {
			visibility: visible;
			top: 22px;
			width: calc(100vw - 70px);
			backdrop-filter: none;
			padding: 0;
			padding-bottom: 10px;
			padding-right: 10px;
		}
		.geocoder-container::after, .geocoder-container::before {
			background: none;
		}
		.pan-row {
			flex-direction: column;
		}
		.title-text {
			text-align: right;
			width: 220px;
			font-size: 16px;
			margin-top: 4px;
		}
		.divider {
			display: none;
		}
		.tour-tab {
			font-size: 14px;
		}
		.filter-container button {
			padding: 4px 7px;
			background: #fff;
		}
		.geocoder-container :global(.mapboxgl-ctrl-geocoder input) {
			height: 35px;
		}
		:global(.mapboxgl-ctrl-geocoder--icon-search) {
			top: 6px;
		}
		:global(.mapboxgl-ctrl-geocoder--icon-close) {
			top: 6px;
		}

		:global(.mapboxgl-ctrl-geocoder--button) {
			background: none;
		}

	}
</style>
