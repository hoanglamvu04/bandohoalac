# Location Service Foundation

## Browser Geolocation

The application uses browser geolocation only when requested by the user.

Collected metadata:

- latitude
- longitude
- accuracy meters
- timestamp

## Important separation

Device location:

```text
where the contributor was standing
```

Official place location:

```text
where the place is stored in Hola Maps
```

These values must not be treated as the same automatically.

## No tracking

Hola Maps does not store continuous movement history.

Location is captured for explicit actions:

- add place
- verify location
- improve accuracy
