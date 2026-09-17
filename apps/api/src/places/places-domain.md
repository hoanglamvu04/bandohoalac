# Places Domain Foundation

## Purpose

The Place entity is the core geographic object owned by Hola Maps.

Map providers are presentation only. Business data remains in Hola Maps database.

## Place lifecycle

A place can be created by:

- Admin team
- Contributor
- Community user

Ownership metadata:

- createdBy
- createdByType
- source
- verificationStatus
- moderationStatus

## Core fields

- id
- slug
- name
- description
- category
- address
- location geometry(Point,4326)
- opening hours
- price information
- verification state
- created timestamps

## GIS requirements

Supported operations:

- nearby places
- radius search
- map bounds query
- category filtering
- distance sorting

PostGIS functions:

- ST_DWithin
- ST_Distance
- ST_Intersects

## Separation

Place location is the official location.

User device location during contribution is separate metadata used only for verification.
