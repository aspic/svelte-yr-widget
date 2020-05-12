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

	import {icons} from './icons'
	import {onMount} from "svelte";
	import {fade} from 'svelte/transition';
	import {quintOut} from 'svelte/easing';
	import Wind from "./Wind.svelte";

	export let lat, lon, name, locale;

	let icon = undefined
	let text = undefined
	let temp = undefined
	let windDirection = undefined
	let windSpeed = undefined

	const localeToDescription = {
		"nn_NO": "desc_nn",
		"nb_NO": "desc_nb",
		"en_GB": "desc_en",
	}
	let selectedLocale = localeToDescription[locale] ? localeToDescription[locale] : localeToDescription["en_GB"];

	onMount(async () => {
		const response = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/?lat=${lat}&lon=${lon}`)
		const {properties: {timeseries}} = await response.json()
		const {data: timeSeriesItem} = timeseries.shift()
		const {next_1_hours: {summary: {symbol_code}}} = timeSeriesItem
		const {instant: {details: {air_temperature, wind_from_direction, wind_speed}}} = timeSeriesItem

		const symbols = icons.filter(i => i.key === symbol_code)
		if (symbols.length > 0) {
			const weatherSymbol = symbols.shift()
			console.log(timeSeriesItem)
			icon = weatherSymbol.svg
			text = weatherSymbol[selectedLocale]
			temp = air_temperature
			windDirection = wind_from_direction
			windSpeed = wind_speed
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
			<div class="text">
				<Wind degrees={windDirection} speed={windSpeed} />
			</div>
	</div>
{:else}
	<div class="container"></div>
{/if}