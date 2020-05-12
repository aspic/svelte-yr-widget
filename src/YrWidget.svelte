<style>
	.icon {
		width: 50px;
		height: 50px;
	}
	.text {
		display: flex;
		align-items: center;
		margin-left: 10px;
	}
	.container {
		display: flex;
		flex-direction: row;
	}
</style>

<script>

	import { icons } from './icons'
	import { onMount } from "svelte";
	import { fade } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';

	export let lat, lon, name;
	let icon = undefined
	let text = undefined
	let temp = undefined

	onMount(async () => {
		const response = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/?lat=${lat}&lon=${lon}`)
		const {properties: { timeseries }} = await response.json()
		const { data: timeSeriesItem } = timeseries.shift()
		const {next_1_hours: {summary: {symbol_code}}} = timeSeriesItem
		const { instant: {details: {air_temperature} } } = timeSeriesItem

		const symbols = icons.filter(i => i.key === symbol_code)
		if(symbols.length > 0) {
			const {svg, desc_nn} = symbols.shift()
			icon = svg
			text = desc_nn
			temp = air_temperature
		}
	})
</script>

{#if icon}
	<div class="container" transition:fade="{{duration: 1000 }}">
			<div class="text">
				<span>{name}</span>
			</div>
			<div class="icon">
				{@html icon}
			</div>
			<div class="text">
				<span> {text} {temp}℃</span>
			</div>
	</div>
{:else}
	<div class="container"></div>
{/if}