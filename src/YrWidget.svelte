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


	import {onMount} from "svelte";
	import {fade} from 'svelte/transition';
	import {quintOut} from 'svelte/easing';
	import Wind from "./Wind.svelte";
	import WeatherSymbol from "./WeatherSymbol.svelte";

	export let lat, lon, locale;
	let temp, windDirection, windSpeed, weatherSymbol = undefined

	onMount(async () => {
		const response = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/?lat=${lat}&lon=${lon}`)
		const {properties: {timeseries}} = await response.json()
		const {data: timeSeriesItem} = timeseries.shift()
		const {next_1_hours: {summary: {symbol_code}}} = timeSeriesItem
		const {instant: {details: {air_temperature, wind_from_direction, wind_speed}}} = timeSeriesItem

		weatherSymbol = symbol_code
		temp = air_temperature
		windDirection = wind_from_direction
		windSpeed = wind_speed

	})
</script>

{#if weatherSymbol}
	<div class="container" transition:fade="{{duration: 1000 }}">
			<div class="text">
				<WeatherSymbol symbolCode={weatherSymbol} locale={locale} />
			</div>
			<div class="text">
				<span>{temp}℃</span>
			</div>
			<div class="text">
				<Wind degrees={windDirection} speed={windSpeed} />
			</div>
	</div>
{:else}
	<div class="container"></div>
{/if}