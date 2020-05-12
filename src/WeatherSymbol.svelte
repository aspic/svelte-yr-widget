<style>
    .container {
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
    }
    .icon {
        width: 50px;
        height: 50px;
    }
</style>

<script>

    import {icons} from './icons'
    import { elasticIn } from 'svelte/easing';
    export let symbolCode, locale = undefined

    let icon = undefined
    let description = undefined

    const localeToDescription = {
        "nn_NO": "desc_nn",
        "nb_NO": "desc_nb",
        "en_GB": "desc_en",
    }
    let selectedLocale = localeToDescription[locale] ? localeToDescription[locale] : localeToDescription["en_GB"];
    const symbols = icons.filter(i => i.key === symbolCode)

    if (symbols.length > 0) {
        const weatherSymbol = symbols.shift()
        icon = weatherSymbol.svg
        description = weatherSymbol[selectedLocale]
    }
    function rotate(node, { duration }) {
        return {
            duration,
            css: t => {
                const eased = elasticIn(1-t);
                return `transform: rotate(${-90 * eased}deg);`
            }
        };
    }

</script>

{#if icon}
    <div class="container">
        <div class="icon" in:rotate="{{duration: 2000}}">{@html icon}</div>
        <span>{description}</span>
    </div>
{:else}
    <div></div>
{/if}