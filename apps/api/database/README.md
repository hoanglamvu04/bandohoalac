# Database foundation

Current phase provides the initial PostGIS domain schema.

Production direction:

- NestJS API owns migrations.
- Drizzle ORM will become the migration/source-of-truth layer.
- SQL files here document the initial relational design.

Migration requirements:

1. Enable PostGIS extension.
2. Apply tables in dependency order.
3. Add indexes after base tables.
4. Run spatial query tests.

Example spatial query:

```sql
SELECT id, name,
ST_Distance(
 location,
 ST_SetSRID(ST_Point(:lng,:lat),4326)
) AS distance
FROM places
WHERE ST_DWithin(
 location,
 ST_SetSRID(ST_Point(:lng,:lat),4326),
 :radiusMeters
)
ORDER BY distance;
```
