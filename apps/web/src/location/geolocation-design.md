# Geolocation Foundation

## Goal

Support current location without tracking user movement.

## Browser flow

```
User clicks locate
        |
Browser Geolocation API
        |
latitude
longitude
accuracy
timestamp
        |
MapLibre user marker
```

## Data separation

Device location:

- temporary
- used for positioning
- used for contribution verification

Official place location:

- stored in PostGIS
- controlled by Place domain

## Add Place future flow

```
Get current location
        |
Show accuracy radius
        |
User adjusts pin
        |
Submit contribution
```

## Privacy rules

- no continuous tracking
- no location history storage
- request permission only when needed
