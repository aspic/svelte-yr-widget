import App from './YrWidget.svelte';

const app = new App({
	target: document.body,
	props: {
		name: 'Voss',
		lat: '60.6494896',
		lon: '6.5240693',
	}
});

export default app;