# Current Location Marker Flow

```text
User opens map
      |
Request location permission
      |
Browser Geolocation API
      |
Receive coordinates
      |
Display user location marker
      |
Optional drag adjustment
```

## State

The UI should track:

- permission state
- loading state
- location available state
- accuracy value
- error state

## Future Add Place integration

The same service will provide initial coordinates for:

Add Place -> GPS -> pin adjustment -> contribution submission
