# Hola Maps

Hola Maps is a community-driven discovery map for the Hoa Lac area (Hanoi).
People browse real places on an interactive map, and Contributors/Explorers
add and improve the data themselves — every submission goes through
moderation before it ever appears publicly.

This is a full-stack MVP: React + Vite frontend, Express REST API,
PostgreSQL + PostGIS for storage, JWT auth, a contribution/moderation
workflow, and a points + trust reputation system.

## Architecture

```
.
├── frontend/          React 18 + Vite + React Router + MapLibre GL JS
├── backend/           Node.js + Express REST API
│   └── src/
│       ├── config/        env loading
│       ├── database/      schema.sql, seed.sql, pool.js, migrate.js, seed.js
│       ├── middleware/     auth, upload, rate limiting, error handling
│       ├── routes/         one file per resource
│       ├── controllers/    HTTP layer
│       ├── services/       business logic + SQL
│       ├── validators/     zod request schemas
│       └── utils/
├── docker-compose.yml  optional, deploy-only (see below) - NOT needed for local dev
└── docs/               planning notes
```

**Domain model.** There is a single `Place` entity — there is no separate
"admin place" vs "user place". Every place has a `source`
(`ADMIN` / `CTV` / `USER`) and a moderation `status`
(`PENDING` / `PUBLISHED` / `REJECTED` / `ARCHIVED`). Contributors and users
never edit places directly — they submit a `Contribution`
(`CREATE_PLACE`, `UPDATE_PLACE`, `ADD_PHOTO`, `FIX_LOCATION`, `UPDATE_HOURS`,
`UPDATE_PRICE`, `REPORT_CLOSED`, `REPORT_WRONG_INFO`), which a moderator
approves or rejects. Approving a contribution runs inside a database
transaction that creates/updates the place, logs the field-level diff in
`contribution_changes`, and credits points via the `points_transactions`
ledger. Points and trust are tracked as independent signals
(`points_total` vs `trust_score` / `approved_count` / `rejected_count`).

The frontend renders maps with MapLibre GL JS. For fast production-style
loading, set `VITE_MAPTILER_KEY` and Hola Maps will use MapTiler Cloud
(`streets-v4` by default). If no MapTiler key is configured, it falls back
to `VITE_MAP_STYLE_URL` / OpenFreeMap, with OpenStreetMap raster as the
runtime safety fallback. Google Maps is only used as an optional external
navigation handoff.

## Requirements

- Node.js 18+
- PostgreSQL 14+ installed **natively** on your machine, with the PostGIS
  extension available (no Docker / no virtualization required — this runs
  the same way a plain Node+Postgres VPS project would)

## Installing PostgreSQL + PostGIS natively

**Windows**

1. Download and run the installer from
   https://www.postgresql.org/download/windows/ (the EDB installer). Pick a
   password for the `postgres` superuser and keep the default port `5432`.
2. Open **Stack Builder** (offered at the end of the installer, or launch it
   from the Start menu) → select your PostgreSQL install → under
   *Spatial Extensions* check **PostGIS** → install it.
3. Confirm both are installed by opening **SQL Shell (psql)** and running:
   ```sql
   CREATE DATABASE hola_maps;
   \c hola_maps
   CREATE EXTENSION postgis;
   SELECT postgis_version();
   ```

**macOS**

```bash
brew install postgresql@16 postgis
brew services start postgresql@16
createdb hola_maps
psql -d hola_maps -c "CREATE EXTENSION postgis;"
```

**Linux (Debian/Ubuntu)**

```bash
sudo apt-get install postgresql postgresql-contrib postgis
sudo service postgresql start
sudo -u postgres createdb hola_maps
sudo -u postgres psql -d hola_maps -c "CREATE EXTENSION postgis;"
```

Once the database exists and `CREATE EXTENSION postgis;` has succeeded,
point `DATABASE_URL` in `backend/.env` at it (see below) — the app's own
`npm run db:migrate` will create every table from there.

## Quick start

```bash
git clone <repo-url> hola-maps
cd hola-maps

# 1. Install everything (root, backend, frontend)
npm install
npm run install:all

# 2. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# edit backend/.env: set DATABASE_URL to your local Postgres password,
# and set JWT_SECRET to a long random string

# 3. Apply schema + seed demo data (database + PostGIS extension must
#    already exist locally, see "Installing PostgreSQL + PostGIS" above)
npm run db:migrate
npm run db:seed

# 4. Run both servers
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:5000/api (health check at `/api/health`)

### Port auto-fallback

Neither dev server hard-crashes if its default port is already taken (e.g.
you run `npm run dev` in two terminals, or something else on your machine
is already listening on 5173/5000):

- **Frontend (Vite):** `server.strictPort` is `false` in `vite.config.js`,
  so if `5173` is busy it automatically tries `5174`, `5175`, ... — watch
  the terminal output for the actual URL it picked.
- **Backend (Express):** if `PORT` (default `5000`) is busy, it retries
  `5001`, `5002`, ... and logs both the fallback and the final address
  (`Server running at: http://localhost:<port>`).
- The backend's CORS policy doesn't hard-code `localhost:5173` — in
  development it accepts any `http://localhost:<port>` / `http://127.0.0.1:<port>`
  origin, so a frontend that fell back to a different port still works
  against the API without any config changes.
- The one thing that **isn't** auto-discovered is `VITE_API_URL`: if the
  backend itself falls back to a non-default port, update
  `frontend/.env` to match the port it actually printed.

### Seeded accounts (local dev only — change/remove before deploying)

| Role       | Email                  | Password       |
|------------|-------------------------|----------------|
| ADMIN      | admin@holamaps.vn       | `Admin@123`    |
| MODERATOR  | moderator@holamaps.vn   | `Moderator@123`|
| CONTRIBUTOR| ctv@holamaps.vn         | `Explorer@123` |
| USER       | user@holamaps.vn        | `Explorer@123` |

## Environment variables

**`backend/.env`** (see `backend/.env.example`):

| Variable | Description |
|---|---|
| `PORT` | API port (default `5000`) |
| `PUBLIC_BASE_URL` | Base URL used to build public URLs for uploaded photos |
| `DATABASE_URL` | Native PostgreSQL connection string, e.g. `postgresql://postgres:PASSWORD@localhost:5432/hola_maps` |
| `JWT_SECRET` | Secret used to sign auth tokens — **must** be set in production |
| `JWT_EXPIRES` | Token lifetime (default `7d`) |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `UPLOAD_DIR` | Local directory for uploaded photos |
| `MAX_UPLOAD_FILE_SIZE_MB` / `MAX_UPLOAD_FILE_COUNT` | Upload limits |

**`frontend/.env`** (see `frontend/.env.example`):

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:5000/api`) |
| `VITE_MAPTILER_KEY` | MapTiler Cloud public browser key. When set, MapTiler becomes the primary basemap provider |
| `VITE_MAPTILER_MAP_ID` | MapTiler map style id (default `streets-v4`) |
| `VITE_MAP_STYLE_URL` | Optional custom/legacy MapLibre style URL used when no MapTiler key is configured |

## Frontend commands

```bash
cd frontend
npm install
npm run dev       # dev server on :5173
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Backend commands

```bash
cd backend
npm install
npm run dev              # node --watch, auto-restarts on file changes
npm run start             # production start
npm run db:migrate        # apply schema.sql
npm run db:migrate:seed   # apply schema.sql + seed.sql in one step
npm run db:seed           # apply seed.sql only
npm test                  # smoke tests (tests/smoke.test.js) against a real DB
```

## Database migrations

`backend/src/database/schema.sql` is idempotent (`CREATE TABLE IF NOT
EXISTS`, `CREATE INDEX IF NOT EXISTS`) and can be re-run safely. There is no
migration framework yet — schema changes are made directly in `schema.sql`
and applied with `npm run db:migrate`. `seed.sql` uses `ON CONFLICT DO
NOTHING` guards so it's also safe to re-run.

## API summary

All routes are prefixed with `/api`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | — | Health check |
| POST | `/auth/register` | — | Create an account |
| POST | `/auth/login` | — | Get a JWT |
| GET | `/auth/me` | user | Current user |
| GET | `/categories` | — | List categories |
| GET | `/places` | — | List published places (`q`, `category`, `limit`, `offset`) |
| GET | `/places/:id` | — | Place by id |
| GET | `/places/slug/:slug` | — | Place by slug |
| GET | `/places/nearby` | — | PostGIS `ST_DWithin`/`ST_Distance` search (`lat`, `lng`, `radius`) |
| GET | `/places/bounds` | — | Places inside a map viewport (`north`,`south`,`east`,`west`) |
| POST | `/contributions` | user | Submit a contribution (multipart: fields + `photos`) |
| GET | `/contributions/me` | user | My contributions |
| GET | `/admin/contributions` | MODERATOR/ADMIN | List contributions (`status`) |
| GET | `/admin/contributions/:id` | MODERATOR/ADMIN | Contribution detail |
| POST | `/admin/contributions/:id/approve` | MODERATOR/ADMIN | Approve (transactional: creates/updates place + awards points) |
| POST | `/admin/contributions/:id/reject` | MODERATOR/ADMIN | Reject with a reason |
| GET | `/users/:id/profile` | — | Public profile (points, stats, badges, recent activity) |
| GET | `/leaderboard` | — | Top explorers by points |

Uploaded photos are served statically from `/uploads/<filename>`.

## Security

- `helmet`, CORS restricted to `CORS_ORIGIN`
- Rate limiting on `/auth/*` and `/contributions`
- Request validation with `zod` on every mutating endpoint
- Parameterized SQL everywhere (no string-built queries)
- JWT secret and DB credentials from environment only
- Passwords hashed with bcrypt
- Upload validation: mime type + extension allowlist (JPG/PNG/WEBP), size
  and file-count limits
- Central error handler hides stack traces in production; explicit 404
  handler

## Deployment notes

- Set `NODE_ENV=production` and a strong `JWT_SECRET` — the server refuses
  to boot in production without one.
- Point `DATABASE_URL` at a managed PostgreSQL instance with PostGIS
  enabled (e.g. Supabase, RDS + PostGIS, Neon does not support PostGIS —
  pick a provider that does), or run PostgreSQL/PostGIS on the VPS itself
  the same way it's installed locally.
- `docker-compose.yml` at the repo root is an optional convenience if you
  ever want a containerized Postgres for CI or a Docker-based deploy — it
  is not part of the local dev workflow and nothing in `npm run dev`
  depends on it.
- Photo storage currently writes to local disk (`UPLOAD_DIR`) behind a thin
  storage abstraction (`backend/src/services/storage.service.js`); swap it
  for Cloudflare R2 (or S3-compatible storage) by changing that module and
  the multer storage engine — nothing else in the codebase references the
  filesystem directly.
- Build the frontend with `npm run build --prefix frontend` and serve
  `frontend/dist/` from a static host or CDN, with `VITE_API_URL` pointed
  at the deployed backend.
- Run `npm run db:migrate` against the production database before first
  deploy; do **not** run `db:seed` in production (it creates demo accounts
  with published default passwords).
