<style>
    div {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        animation-fill-mode: forwards;
    }
</style>

<script>

    import { elasticOut } from 'svelte/easing';
    const full = 180
    export let degrees = 0
    export let speed = 0

    function rotate(node, { duration }) {
        return {
            duration,
            css: t => {
                const eased = elasticOut(t);

                return `transform: rotate(${(full - degrees) * eased}deg);`
            }
        };
    }
</script>

{#if degrees}
    <div transition:rotate="{{duration: 2000}}" style='transform: rotate({full - degrees}deg)'>
        <span>⟼</span>
    </div>
    <span>{speed} m/s</span>
{:else}
    <div></div>
{/if}