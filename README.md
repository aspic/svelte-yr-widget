# svelte-yr-widget

**Demo:** [widget](https://aspic.github.io/svelte-yr-widget/) 

A simple widget for showing weather data from [Yr.no](https://www.yr.no/?spr=eng).

Relevant API documentation: [api.met.no](https://api.met.no/weatherapi/locationforecast/2.0/documentation)

## Install

With yarn `$ yarn add svelte-yr-widget` or npm: `$ npm install svelte-yr-widget`

## Usage

```javascript
    <script>
        import YrWidget from 'svelte-yr-widget';
    </script>

    <YrWidget 
        lat="59.8939529" 
        lon="10.6450361"
        place="Oslo" // optional
        locale="en_GB" // optional
    />
```

## To run project locally

```bash
$ yarn
$ yarn dev
```

## Dependency on YR Weather Symbols

To display weather symbols this app extracts all SVGs from [YR Weather Symbols](https://github.com/nrkno/yr-weather-symbols)
and matches these with the specification on [weathericons](https://api.met.no/weatherapi/weathericon/1.1/documentation).
