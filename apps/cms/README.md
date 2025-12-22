# RankSheet CMS (`cms.ranksheet.com`)

Payload CMS + Postgres (Supabase) running inside a Next.js app.

## Local development

From `ranksheet.com/`:

```bash
cd apps/cms
docker compose -f docker-compose.dev.yml up -d
cp .env.example .env.local
pnpm db:migrate
pnpm dev
```

Admin UI: `http://localhost:3006/admin`

## Optional seeding

This seed script is guarded to prevent accidental production use.

```bash
RS_ALLOW_SEED=1 \
RS_SEED_ADMIN_EMAIL=admin@ranksheet.local \
RS_SEED_ADMIN_PASSWORD='change-me' \
RS_SEED_SAMPLE_KEYWORDS=1 \
pnpm db:seed
```

To run in production you must also set `RS_ALLOW_SEED_PROD=1`.

## HTTP APIs

- Public (sanitized): `GET /api/public/keywords`, `GET /api/public/sheets/:slug`
- Admin (requires `x-job-token`): `POST /api/admin/refresh/:slug`, `POST /api/admin/refresh-all`, `GET /api/admin/job/:id`
- Ops: `GET /api/healthz`
- Monitoring: `GET /api/circuit-breakers`, `GET /api/pool-stats`

RankSheet public APIs never expose raw percentage shares.

## Security Scanning

Run security scans before deployment:

```bash
# Quick scan (Dockerfile + filesystem)
make security-scan

# Full scan (includes Docker image)
make security-scan
make trivy-image
```

**Documentation:**
- Full guide: [SECURITY_SCANNING.md](./SECURITY_SCANNING.md)
- Quick reference: [SECURITY_QUICK_REFERENCE.md](./SECURITY_QUICK_REFERENCE.md)

**CI/CD:** GitHub Actions runs automated security scans on every push and weekly.
