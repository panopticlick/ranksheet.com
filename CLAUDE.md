# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RankSheet.com is an Amazon vertical category market ticker application built as a **pnpm monorepo**:

- **`apps/cms`**: Payload CMS 3.68 + Postgres backend (deployed to VPS Docker at `cms.ranksheet.com`)
- **`apps/web`**: Next.js 15.5 frontend (deployed to Cloudflare Pages at `ranksheet.com`)
- **`packages/shared`**: Shared TypeScript types and Zod validation schemas

The project consumes Amazon Brand Analytics (ABA) data from FastAPI and Express APIs to generate **sanitized** ranking tables with derived metrics. **Raw click/conversion share percentages are never exposed** in public APIs.

## Common Commands

### Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start CMS locally (requires Postgres via Docker)
cd apps/cms
docker compose -f docker-compose.dev.yml up -d
cp .env.example .env.local
pnpm db:migrate
pnpm dev  # Runs on http://localhost:3006

# Start Web locally (requires CMS running)
cd apps/web
cp .env.example .env.local
pnpm dev  # Runs on http://localhost:3003

# Or run from monorepo root
pnpm dev:cms  # Start CMS
pnpm dev:web  # Start Web
```

### Database Operations (CMS only)

```bash
cd apps/cms

# Run migrations
pnpm db:migrate

# Optional seeding (local/dev only, guarded)
RS_ALLOW_SEED=1 \
RS_SEED_ADMIN_EMAIL=admin@ranksheet.local \
RS_SEED_ADMIN_PASSWORD='change-me' \
RS_SEED_SAMPLE_KEYWORDS=1 \
pnpm db:seed
```

### Build & Test

```bash
# Build all packages
pnpm build

# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck

# Run tests
pnpm test
```

### Cloudflare Deployment (Web only)

```bash
cd apps/web

# Build for Cloudflare using OpenNext
pnpm cf:build

# Preview locally
pnpm cf:preview

# Deploy to Cloudflare
pnpm cf:deploy
```

### Testing Single Files

```bash
# Run specific test file
pnpm test -- path/to/test.test.ts

# Watch mode
pnpm test -- --watch path/to/test.test.ts
```

## High-Level Architecture

### Data Flow

```
ClickHouse (amazon_aba)
    ↓
FastAPI (fastapi.amzapi.io) ← ABA keyword-level aggregations
    ↓
Express (express.amzapi.io) ← Product entity cache + PA-API5
    ↓
CMS Pipeline (Refresh Jobs) ← Dedupe + Scoring + Readiness checks
    ↓
Payload Collections (keywords, rank-sheets)
    ↓
Public API (/api/public/*) ← Sanitized data only
    ↓
Next.js Web (SSR/Edge cache) ← Sheet pages + Trends + Search
```

### CMS Backend (`apps/cms`)

**Purpose**: Data pipeline, sanitization layer, and headless CMS API

**Key Responsibilities:**
- Payload CMS admin interface at `/admin`
- Postgres storage for keywords and rank sheets (schema: `ranksheet`)
- **Public APIs** (`/api/public/*`) serving sanitized data to Web
- **Admin APIs** (`/api/admin/*`) protected by `x-job-token` header
- Background refresh pipeline (executed via cron or manual trigger)

**Core Pipeline** (`src/lib/ranksheet/`):
- `refreshKeyword.ts`: Single keyword refresh orchestration with distributed locking
- `refreshAll.ts`: Batch keyword refresh with concurrency control
- `dedupe.ts`: Variant deduplication (parentAsin/variationGroup/brand+title heuristics)
- `scoring.ts`: Derived metric calculation (Index 0-100, Score, Tier, Trend)
- `readiness.ts`: Image/data quality gates (FULL/PARTIAL/LOW/CRITICAL)
- `productCard.ts`: Product enrichment from Express API
- `asinCache.ts`: Local ASIN cache to reduce API calls by 90%
- `trends.ts`: Historical rank trajectory data

**Payload Collections:**
- `keywords`: Configuration table (slug, keyword, category, topN, status, indexable)
- `rank-sheets`: Snapshot table (sanitized rows, history, readinessLevel, validCount)
- `AsinCache`: Product metadata cache with 7-30 day TTL
- `KeywordRequests`: User-submitted keyword requests with voting
- `Users`: Admin authentication (role-based access)

**Important**: The CMS uses **Postgres schema isolation** (`?schema=ranksheet` in DATABASE_URI) to avoid conflicts with other services sharing the same database.

### Web Frontend (`apps/web`)

**Purpose**: Purely presentational layer consuming CMS public APIs

**Key Responsibilities:**
- Server-side rendered sheet pages at `/{slug}`
- Category hub pages at `/category/{category}`
- Search, compare, and keyword request features
- Outbound affiliate link tracking via `/go/{asin}`
- Edge-cached trend API proxy at `/api/sheet-trends`

**Data Fetching:**
All data fetched from CMS public API (`CMS_PUBLIC_URL/api/public/*`):
- `GET /api/public/sheets/:slug` - Full sheet data + related sheets
- `GET /api/public/keywords` - Keyword list (filterable by category)
- `GET /api/public/categories/:category/tickers` - Category highlights
- Sheet trend data proxied through `/api/sheet-trends` for edge caching

**Deployment**: Cloudflare Pages using OpenNext adapter for Next.js 15 compatibility

## Critical Design Principles

### 1. Data Sanitization

**NEVER expose raw ABA metrics** (`click_share`, `conversion_share` percentages) in public APIs or frontend. Only show:
- **Indices**: Normalized scores (0-100 scale)
- **Tiered badges**: High/Medium/Low based on percentile thresholds
- **Trend indicators**: Rising/Falling/Stable based on rank changes
- **Relative scores**: Composite scores from multiple normalized metrics

### 2. Quality Gates

The refresh pipeline enforces strict quality before publishing:
1. **Variant Deduplication**: Parent ASINs and variation groups prevent duplicate listings
2. **Readiness Levels**: Images/data completeness checked (FULL/PARTIAL/LOW/CRITICAL)
3. **Low Data Mode**: Sheets with <3 valid results get `indexable=false` + `noindex` meta
4. **Warm-up Prevention**: New keywords with insufficient image coverage don't publish

### 3. Distributed Locking

Use Postgres advisory locks to prevent concurrent refreshes of the same keyword:

```typescript
await withAdvisoryLock(`refresh:keyword:${slug}`, async () => {
  // Refresh logic here
})
```

### 4. Type Safety with Zod

All external data is validated with Zod schemas from `@ranksheet/shared`:
- `SanitizedRowSchema`: Public-facing row structure
- `PublicSheetsResponseSchema`: API response format
- Payload generates `payload-types.ts` for collection types

## Environment Variables

### CMS (`.env.example`)

```bash
# Core
NODE_ENV=development
SITE_URL=http://localhost:3006
DATABASE_URI=postgresql://user:password@localhost:54321/postgres?schema=ranksheet
REDIS_URL=redis://localhost:6379

# Payload
PAYLOAD_SECRET=<32+ char secret>

# External APIs
FASTAPI_URL=https://fastapi.amzapi.io/api/v2
FASTAPI_KEY=<api-key>
EXPRESS_URL=https://express.amzapi.io/api/v1
EXPRESS_API_KEY=<api-key>

# Admin jobs
JOB_TOKEN=<admin-api-token>

# Security
IP_HASH_SALT=<random-salt>
RS_STRICT_ENV=1  # Enable strict env validation

# Optional: AI/LLM integrations
LLM_API_BASE_URL=https://vectorengine.apifox.cn
LLM_API_KEY=<llm-key>
KEYWORDS_EVERYWHERE_API_KEY=<ke-key>
```

### Web (`.env.example`)

```bash
# Core
NODE_ENV=production
SITE_URL=https://ranksheet.com
CMS_PUBLIC_URL=https://cms.ranksheet.com

# Optional
AMAZON_ASSOCIATE_TAG=<affiliate-tag>
```

## Important Code Patterns

### Refresh Pipeline Flow

```typescript
// Single keyword refresh
refreshKeywordBySlug(slug)
  ├─ Acquire distributed lock (prevent concurrent refreshes)
  ├─ Fetch keyword config from Payload
  ├─ Get weekly report dates from FastAPI (with Redis cache)
  ├─ Fetch keyword ASINs from FastAPI (top-ranked products)
  ├─ Deduplicate variations (parentAsin, variationGroup, heuristics)
  ├─ Fetch product details from Express API (with AsinCache)
  ├─ Compute sanitized rows (scores, indices, trends)
  ├─ Calculate readiness level based on valid count
  ├─ Store RankSheet record in Postgres
  └─ Update keyword.lastRefreshedAt
```

### Caching Strategy

1. **Redis** (CMS server-side):
   - Report dates (FastAPI): 6 hour TTL
   - Rate limiting: Per-IP tracking with Redis
   - Optional: API call results

2. **AsinCache Table** (Postgres):
   - 7-30 day TTL per entry based on data freshness
   - **Negative caching**: Store NOT_FOUND entries (7 day TTL)
   - Reduces Express API calls by 90%+

3. **Web-side**:
   - SSR pages: `revalidate = 600` (10 minutes ISR)
   - Edge cache at Cloudflare with stale-while-revalidate
   - Trend API proxy for long-lived caching

### Circuit Breaker Pattern

All external API calls are wrapped with circuit breaker to prevent cascading failures:

```typescript
// File: lib/circuitBreaker.ts
// Configured per service (FastAPI, Express)
// Half-open state after cooldown period
```

## Payload CMS Notes

- **Version**: Payload CMS 3.0.0-beta.79 (Beta, but stable for this use case)
- **Database Adapter**: `@payloadcms/db-postgres` with Drizzle ORM
- **Rich Text**: Lexical editor (`@payloadcms/richtext-lexical`)
- **Migrations**: Stored in `src/migrations/`, run with `pnpm db:migrate`
- **Collections**: Defined in `src/payload/collections/`

**Important**: Payload 3.x does NOT support collection-level `indexes` property. All indexes must be created in migrations using `sql` tagged templates.

## Security

### Rate Limiting

- Implemented using Redis + IP hashing
- Per-IP limits on public endpoints
- Admin endpoints protected by `x-job-token` header

### Environment Validation

- **Strict mode** (`RS_STRICT_ENV=1`): Required env vars checked at startup
- Missing variables cause immediate failure (no silent defaults)

### Security Scanning

```bash
# Run before deployment (from apps/cms)
make security-scan     # Hadolint + Trivy filesystem scan
make trivy-image       # Docker image vulnerability scan
```

See `apps/cms/SECURITY_SCANNING.md` for full details.

## Deployment

### CMS (VPS Docker)

Deployed as standalone Next.js app in Docker:

```bash
# Build (from monorepo root)
docker build -f apps/cms/Dockerfile -t ranksheet-cms .

# Run
docker run -d \
  -p 3006:3000 \
  -e DATABASE_URI="postgresql://..." \
  -e PAYLOAD_SECRET="..." \
  --name ranksheet-cms \
  ranksheet-cms
```

Or use `docker-compose.prod.yml`:

```bash
cd apps/cms
make deploy  # Wrapper for docker compose up -d --build
```

### Web (Cloudflare Pages)

Uses OpenNext adapter for Next.js → Workers compatibility:

```bash
cd apps/web
pnpm cf:build    # Build .open-next/ directory
pnpm cf:deploy   # Deploy to Cloudflare
```

## Troubleshooting

### Build Errors

**TypeScript errors during build**:
- Check `payload-types.ts` is generated: Run `pnpm db:migrate` in CMS
- Ensure shared types are built: Run `pnpm build` from monorepo root
- Migration syntax: Use `sql` tagged template, not plain strings

**Example correct migration**:
```typescript
import { MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ payload }: MigrateUpArgs) {
  await payload.db.execute({
    sql: sql`CREATE INDEX ... ON ranksheet.keywords ...`,
  })
}
```

### Runtime Issues

**CMS 404 on all routes**:
- Ensure Postgres connection is working
- Check `DATABASE_URI` includes `?schema=ranksheet`
- Verify migrations ran: `pnpm db:migrate`

**Web can't fetch data**:
- Check `CMS_PUBLIC_URL` points to running CMS instance
- Verify CMS public APIs are accessible: `curl $CMS_PUBLIC_URL/api/public/keywords`

**Refresh pipeline fails**:
- Check external API keys are valid (FASTAPI_KEY, EXPRESS_API_KEY)
- Verify Redis is running if using cache
- Check Postgres advisory locks aren't stuck: Query `pg_locks`

## Additional Documentation

- **CMS README**: `apps/cms/README.md` - Local development setup
- **Web README**: `apps/web/README.md` - Cloudflare deployment
- **Security**: `apps/cms/SECURITY_SCANNING.md` - Vulnerability scanning
- **Cron Setup**: `apps/cms/docs/CRON_SETUP.md` - Scheduled refresh jobs
- **Project Docs**: `:docs/` directory - Detailed technical specifications

## Related Projects

This project is part of the ABA data ecosystem at `/Volumes/SSD/amazon/aba-data/`:
- `sellermirror.com`: Reference implementation using same data sources
- `amzdata.io`: SaaS application for ABA insights
