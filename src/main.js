import App from './YrWidget.svelte';

const app = new App({
	target: document.body,
	props: {
		name: 'Voss',
		lat: '60.6266895',
		lon: '6.38204',
	}
});

export default app;