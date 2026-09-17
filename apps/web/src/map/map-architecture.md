# MapLibre Foundation

## Purpose

Map rendering is treated as a presentation layer. Hola Maps domain data remains independent from any map vendor.

## Architecture

```
Place API
   |
Map Data Adapter
   |
MapLibre GL JS
   |
Tile Provider
```

## Provider abstraction

The frontend must not store provider-specific identifiers as business data.

Supported future providers:

- MapTiler
- OpenMapTiles
- Protomaps
- self-hosted tiles

## Map responsibilities

- render map viewport
- display place markers
- handle bounds changes
- display user location
- provide interaction events

The map does not own:

- places
- categories
- reviews
- contributions

## Layers

Suggested layers:

- base map layer
- place marker layer
- selected place layer
- user location layer
- contribution pin layer
