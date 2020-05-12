const fs = require('fs').promises;

const readFile = async (key, url, desc_nn, desc_en, desc_nb) => {
    const f = await fs.readFile(url, 'UTF8')
    return {
        key: key,
        svg: f,
        desc_nn: desc_nn,
        desc_nb: desc_nb,
        desc_en: desc_en,
    }
}

const variantToFile = async (data, key) => {
    const { variants, old_id, desc_nn, desc_en, desc_nb } = data[key]
    const realId = old_id < 10 ? `0${old_id}` : `${old_id}`

    if(variants === null) {
        return [await readFile(key, `node_modules/@yr/weather-symbols/dist/svg/${realId}.svg`, desc_nn, desc_en, desc_nb)]
    } else {

        let files = []
        for (let i = 0; i < variants.length; i++) {
            const variant = variants[i]
            if(variant === 'day') {
                const res = await readFile(`${key}_${variant}`, `node_modules/@yr/weather-symbols/dist/svg/${realId}d.svg`, desc_nn, desc_en, desc_nb)
                files.push(res)
            } else if(variant === 'night') {
                const res = await readFile(`${key}_${variant}`, `node_modules/@yr/weather-symbols/dist/svg/${realId}n.svg`, desc_nn, desc_en, desc_nb)
                files.push(res)
            }
        }
        return files
    }
}

async function readAndSet() {
    const data = await fs.readFile("bin/legends.json", "UTF8");
    const defs = JSON.parse(data)
    let all = []
    const keys = Object.keys(defs)
    for (let i = 0; i < keys.length; i++) {
        all = all.concat(await variantToFile(defs, keys[i]))
    }
    const map = JSON.stringify(all)
    const js = `export const icons = ${map}`
    await fs.writeFile('src/icons.js', js)
}

readAndSet()

