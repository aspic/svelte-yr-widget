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
    export let degrees = 0

    console.log(degrees)

    function rotate(node, { duration }) {
        return {
            duration,
            css: t => {
                const eased = elasticOut(t);

                return `transform: rotate(${-degrees * eased}deg);`
            }
        };
    }
</script>

{#if degrees}
    <div transition:rotate="{{duration: 2000}}" style='transform: rotate({-degrees}deg)'>
        <span>⟼</span>
    </div>
{:else}
    <div></div>
{/if}