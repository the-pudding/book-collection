<script>
	// shadow, plain, line, bubble
	import wordmark from "$svg/wordmark-classic-copy.svg";
</script>

<header>
	<div class="wordmark">
		<a href="https://pudding.cool" aria-label="The Pudding" target="_self"
			>{@html wordmark}</a
		>
	</div>
</header>

<style>

	header {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 10000000;
		overflow: hidden;
		
	}
	.wordmark {
		max-width: 14em;
		pointer-events: auto;
		margin: 0;
		padding: 6px 18px;
		/* transform: translate(0, -19px) rotate(-4deg); */
	}

	:global(.wordmark #color-stroke)  {
		opacity: 0.9;
		/* filter: blur(0.2px); */
    	transform: translate(4px, 5px);
	}

	.wordmark a {
		border: none;
		display: block;
		color: var(--color-fg);
	}

	:global(.wordmark path:not([id="color-stroke"])) {
		filter: drop-shadow(2px 2px 0px var(--color-bg));
	}

	.wordmark a:hover {
		background-color: transparent;
	}

	@media (max-width: 400px) {
		.wordmark {
			max-width: 10.5em;
			padding-left: 8px;
			/* transform: translate(-18px, -19px) rotate(-4deg); */
		}

		header {
			/* existing styles are above, so add only the overlay gradient here */
			background: linear-gradient(to bottom, rgb(255 254 245) 0px, rgb(255 254 245) 52px, rgba(255, 252, 227, 0) 100px);
		}
	}
	@media (max-width: 360px) {
		.wordmark {
			max-width: 10.5em;
			/* transform: translate(-14px, -15px) rotate(-4deg); */
		}
	}

</style>
