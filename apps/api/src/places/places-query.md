# Places Query Layer

## Query patterns

### Nearby search

Input:

- latitude
- longitude
- radius meters

Implementation direction:

ST_DWithin(location, userPoint, radius)

## Distance sorting

Use:

ST_Distance(location, userPoint)

Return calculated distance without storing duplicated values.

## Map bounds

Input:

- north
- south
- east
- west

Use bounding geometry intersection:

ST_Intersects(location, bounds)

## Filtering

Composable filters:

- category
- attributes
- verification status
- rating
- availability

## Repository boundary

Controllers should not contain SQL.

Controller -> Service -> Repository -> PostGIS query.
