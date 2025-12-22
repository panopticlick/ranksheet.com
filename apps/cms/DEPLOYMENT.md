# RankSheet CMS Deployment (VPS / Docker)

This CMS is a Next.js + Payload app intended to run on `cms.ranksheet.com` inside Docker and connect to the **existing Supabase Postgres** on the same host.

## Prereqs (Server)

- Supabase is deployed on the server and running (see the Supabase runbook in `/opt/docker-projects/supabase`).
- Docker network `supabase_default` exists (created by Supabase compose).
- DNS + TLS for `cms.ranksheet.com` is configured (Caddy / Nginx / Cloudflare).

## 1) Create deployment dir

```bash
ssh root@107.174.42.198
mkdir -p /opt/docker-projects/ranksheet-cms
cd /opt/docker-projects/ranksheet-cms
```

## 2) Copy compose + env

Copy these files from this repo:

- `apps/cms/docker-compose.prod.yml` → `/opt/docker-projects/ranksheet-cms/docker-compose.yml`
- `apps/cms/.env.production.example` → `/opt/docker-projects/ranksheet-cms/.env` (fill values)

## 3) Fill `.env` (important)

Required:

- `PAYLOAD_SECRET` (>= 32 chars)
- `DATABASE_URI` (must include `?schema=ranksheet`)
- `FASTAPI_KEY`, `EXPRESS_API_KEY`
- `JOB_TOKEN` (admin job auth)
- `IP_HASH_SALT` (rate limit hashing)

If Supabase is on the same Docker network, use:

```bash
DATABASE_URI=postgresql://postgres:${POSTGRES_PASSWORD}@supabase-db:5432/postgres?schema=ranksheet
```

## 4) Run migrations (creates schema + extra tables + Payload tables)

```bash
docker compose run --rm cms pnpm db:migrate
```

## 5) Start CMS

```bash
docker compose up -d --build
docker ps | grep ranksheet-cms
```

Health checks:

```bash
curl -fsS http://127.0.0.1:3000/api/healthz | jq
curl -fsS http://127.0.0.1:3000/admin >/dev/null
```

## 6) Cron (weekly refresh)

Example cron entry (runs every Monday 03:00 UTC):

```bash
0 3 * * 1 curl -fsS -X POST https://cms.ranksheet.com/api/admin/refresh-all \
  -H "x-job-token: ${JOB_TOKEN}" \
  -H "content-type: application/json" \
  --data '{"concurrency":3}' >/dev/null
```

Notes:

- Refresh jobs are persisted in Postgres (`ranksheet.job_runs`).
- Public endpoints are always sanitized (no raw ABA %).

