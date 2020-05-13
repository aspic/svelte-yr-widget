import App from './YrWidget.svelte';

const app = new App({
	target: document.body,
	props: {
		lat: '60.6266895',
		lon: '6.38204',
		locale: 'en_GB',
		place: 'Voss',
	}
});

export default app;