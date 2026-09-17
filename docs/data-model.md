# Hola Maps Data Model

## Database choice

Hola Maps uses PostgreSQL + PostGIS as the source of truth for all geographic domain data.

The map renderer/provider does not own place data. MapLibre is only a visualization layer.

## Core principles

- One `places` table for all locations.
- Admin-created and community-created places share the same domain model.
- Every important change is traceable through contributions and revisions.
- Geographic queries use PostGIS geometry types.

## Spatial model

`places.location`

```sql
geometry(Point, 4326)
```

Recommended index:

```sql
CREATE INDEX places_location_gix
ON places
USING GIST(location);
```

Supported queries:

- nearby places with `ST_DWithin`
- map viewport with `ST_Intersects`
- distance sorting with `ST_Distance`

---

# Main entities

## users

Identity and authentication account.

Fields:

- id UUID
- email
- password_hash
- status
- created_at
- updated_at

## profiles

Public contributor information.

Fields:

- user_id
- username
- display_name
- avatar_url
- bio
- contributor_level

## roles

RBAC definitions.

Examples:

- USER
- CONTRIBUTOR
- TRUSTED_CONTRIBUTOR
- MODERATOR
- ADMIN
- SUPER_ADMIN

---

# Place domain

## places

The canonical location entity.

Important fields:

- id UUID
- slug
- name
- description
- location geometry(Point,4326)
- address
- phone
- website
- created_by
- created_by_type
- source
- verification_status
- moderation_status
- created_at
- updated_at

`created_by_type` examples:

- ADMIN
- CONTRIBUTOR
- IMPORTED

---

## categories

Examples:

- cafe
- restaurant
- homestay
- villa
- attraction
- shopping

Many-to-many relationship through:

`place_categories`

---

## attributes

Flexible characteristics.

Examples:

- parking
- pet_friendly
- price_range
- opening_hours
- wifi

Values are stored separately to avoid changing schema for every new discovery feature.

---

# Media

## place_media

Stores metadata only.

Actual files live in object storage (R2/S3 compatible).

Fields:

- id
- place_id
- storage_key
- url
- mime_type
- uploaded_by
- moderation_status

---

# Community contribution model

## contributions

User proposals.

Types:

- CREATE_PLACE
- EDIT_PLACE
- ADD_PHOTO
- CHANGE_LOCATION
- CHANGE_OPENING_HOURS
- CHANGE_PRICE
- REPORT_CLOSED
- REPORT_INCORRECT

Lifecycle:

DRAFT -> SUBMITTED -> PENDING -> APPROVED/REJECTED

---

## place_revisions

Immutable history of accepted changes.

Purpose:

- audit
- rollback
- trust calculation
- moderation transparency

---

# Reputation

## points_ledger

Never store only a mutable point counter.

Every score change has a transaction record.

Fields:

- id
- user_id
- contribution_id
- points_delta
- reason
- created_at

Supports:

- reward
- reversal
- audit

## trust score

Separate from public points.

Trust is internal moderation intelligence.

---

# Reviews and collections

## reviews

User experience feedback.

## favorites

Saved places.

## collections

User-curated lists.

Example:

"Cafe đẹp quanh Hòa Lạc"

---

# Moderation

## reports

User reports:

- closed place
- wrong location
- inappropriate content

## moderation_actions

Audit table for moderator decisions.

---

# Future spatial optimization

Possible additions:

- materialized views for popular areas
- geohash cache layer
- Redis nearby cache
- vector tile generation

These are optimization layers, not the source of truth.
