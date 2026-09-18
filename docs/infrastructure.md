# Hola Maps Infrastructure

## Development database

The project uses PostgreSQL with PostGIS extension.

Start database:

```bash
docker compose up -d postgres
```

Database capabilities:

- PostgreSQL 16
- PostGIS 3.4
- pgcrypto UUID support

## Environment

Copy:

```bash
.env.example .env
```

Never commit production secrets.

## Future deployment

Production can run:

- managed PostgreSQL + PostGIS
- VPS Docker deployment
- cloud database providers supporting PostGIS
