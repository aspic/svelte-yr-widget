# svelte-yr-widget

A simple widget for showing weather data from [Yr.no](https://www.yr.no/?spr=eng).

Relevant API documentation: [api.met.no](https://api.met.no/weatherapi/locationforecast/2.0/documentation)

## To run locally

```bash
$ yarn
$ yarn dev
```

## Dependency on YR Weather Symbols

To display weather symbols this app extracts all SVGs from [YR Weather Symbols](https://github.com/nrkno/yr-weather-symbols)
and matches these with the specification on [weathericons](https://api.met.no/weatherapi/weathericon/1.1/documentation).