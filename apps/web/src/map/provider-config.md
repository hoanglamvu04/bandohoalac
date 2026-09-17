# Map Provider Configuration

## Rule

Provider configuration must be environment driven.

Example:

```
NEXT_PUBLIC_MAP_STYLE_URL
NEXT_PUBLIC_MAP_TILES_URL
```

No provider credentials or URLs should be hard-coded inside components.

## Future switching

Changing map provider should only affect adapter/configuration layer.

Business components continue consuming:

- Place markers
- Map viewport
- User location
- Bounds events
