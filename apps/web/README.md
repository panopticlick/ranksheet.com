# RankSheet Web (`ranksheet.com`)

Next.js App Router site deployed to Cloudflare using OpenNext.

## Local development

1) Start CMS locally (`apps/cms`) on `http://localhost:3006`
2) Start the web app:

```bash
cd apps/web
cp .env.example .env.local
pnpm dev
```

## Cloudflare (OpenNext) build & deploy

```bash
pnpm cf:build
pnpm cf:preview
pnpm cf:deploy
```

Primary API integration:

- `GET /api/search?q=...` (keyword search suggestions)
- `GET /api/sheet-trends?slug=...` (rank trajectory data for Top products)
- `GET/POST /api/keyword-requests` + `POST /api/keyword-requests/:id/vote` (public keyword request board)
- `GET /go/:asin` (outbound redirect + click tracking)
