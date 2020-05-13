import App from './YrWidget.svelte';

const app = new App({
	target: document.body,
	props: {
		name: 'Voss',
		lat: '60.626714',
		lon: '6.3995496',
	}
});

export default app;