# MapLibre Architecture Foundation

## Purpose

The map layer is a presentation layer only. Hola Maps domain data remains independent from any map provider.

## Provider abstraction

```text
Map UI
  |
Map Adapter
  |
Map Provider Config
  |
MapLibre / other compatible providers
```

Possible future providers:
- MapTiler
- OpenMapTiles
- Protomaps
- self-hosted tiles

## Responsibilities

Map feature handles:
- rendering map
- viewport state
- markers
- user interaction

It does not own:
- places database
- categories
- moderation
- contributions
