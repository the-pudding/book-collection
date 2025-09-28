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
	<soot-publication bind:this={sootElement} slug="4be2a35c-952d-4090-ac9f-89879cf1bcf9"></soot-publication>
	</div>
</svelte:boundary>

<style>
	#soot-publication {
		width: 800px;
		height: 500px;
	}

</style>
