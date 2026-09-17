# Hola Maps Architecture

## Vision

Hola Maps is a community-driven local discovery platform for Hoa Lac. The system owns domain data and treats mapping providers as presentation infrastructure only.

## Core Principles

- Domain-first architecture
- Provider-independent geospatial data
- Auditable community contributions
- Secure role-based access control
- Mobile-first experience

## Planned Architecture

```
apps/
  web/  - Next.js React TypeScript frontend
  api/  - NestJS REST API
packages/
  ui/
  types/
  validation/
  config/
```

## GIS Boundary

Places store their canonical coordinates in PostgreSQL/PostGIS. MapLibre renders spatial data but does not own business data.

## Domain Ownership

The platform owns:
- places
- categories
- users
- contributions
- revisions
- reviews
- trust and points

External map services may provide tiles or directions, but are not the source of truth.
