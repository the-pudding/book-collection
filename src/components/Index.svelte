<script>
	import { onMount } from "svelte";
	import { browser } from "$app/environment";

	let sootElement;

	onMount(async () => {
		if (browser) {
			await import("soot-webcomponents");

			sootElement.addEventListener('loadComplete', async (e) => {
			console.log('SOOT space loaded!', e.detail);
			const views = await sootElement.expose.getViews();
			console.log('Views:', views);
			console.log(sootElement);
			});

			sootElement.addEventListener('selectInstance', (e) => {
				console.log('Instance selected:', e.detail);
			});
		}
	});


</script>

<svelte:boundary onerror={(e) => console.error(e)}>
	<div id="soot-publication">
	<soot-publication
		bind:this={sootElement} slug="30aeca63-79f1-44b1-b7ca-f8c04eaa5f77"
		introstartz="3"
		introendz="20"
	>

	</soot-publication>
	</div>
</svelte:boundary>

<style>
	#soot-publication {
		width: 800px;
		height: 500px;
	}

</style>
