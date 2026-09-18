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
├── docker-compose.yml  PostGIS-enabled PostgreSQL for local dev
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

Map tiles come from MapLibre GL JS against an OSS vector style (configurable
via `VITE_MAP_STYLE_URL`) — the system is not locked into Google Maps.
Google Maps is only used as an optional external "Get directions" link on
a place's detail page.

## Requirements

- Node.js 18+
- PostgreSQL 14+ with the PostGIS extension (via Docker, or installed
  locally)
- Docker (optional, but the easiest way to get PostGIS running)

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
# edit backend/.env: set JWT_SECRET to a long random string

# 3. Start PostgreSQL + PostGIS (via Docker)
npm run db:up

# 4. Apply schema + seed demo data
npm run db:migrate
npm run db:seed

# 5. Run both servers
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:5000/api (health check at `/api/health`)

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
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign auth tokens — **must** be set in production |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `CORS_ORIGIN` | Comma-separated list of allowed frontend origins |
| `UPLOAD_DIR` | Local directory for uploaded photos |
| `MAX_UPLOAD_FILE_SIZE_MB` / `MAX_UPLOAD_FILE_COUNT` | Upload limits |

**`frontend/.env`** (see `frontend/.env.example`):

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `http://localhost:5000/api`) |
| `VITE_MAP_STYLE_URL` | MapLibre style URL |

**Docker Compose** reads `POSTGRES_USER` / `POSTGRES_PASSWORD` /
`POSTGRES_DB` / `POSTGRES_PORT` from the environment, defaulting to
`hola` / `hola` / `hola_maps` / `5432` — keep these in sync with
`DATABASE_URL` in `backend/.env`.

## Docker / PostGIS setup

```bash
npm run db:up     # docker compose up -d db (with healthcheck)
npm run db:down   # docker compose down
```

Without Docker, install PostgreSQL 14+ and the PostGIS extension locally,
create a database, then point `DATABASE_URL` at it before running
`npm run db:migrate`.

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
  pick a provider that does).
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
