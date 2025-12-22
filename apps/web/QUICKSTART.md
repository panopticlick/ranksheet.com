# Quick Start Guide - Cloudflare Deployment

This guide helps you deploy RankSheet Web to Cloudflare Pages in under 5 minutes.

## Prerequisites

- Node.js 20+ and pnpm 10+ installed
- Cloudflare account with Workers/Pages enabled
- Access to CMS backend (cms.ranksheet.com)

## Step 1: Clone and Install

```bash
# From monorepo root
pnpm install
```

## Step 2: Configure Wrangler

```bash
cd apps/web

# Copy template
cp wrangler.jsonc.example wrangler.jsonc

# Edit wrangler.jsonc and add your account_id
# Get it from: https://dash.cloudflare.com/ > Click your account > Copy Account ID
```

Edit `wrangler.jsonc`:
```jsonc
{
  // ... existing config ...
  "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID_HERE"
}
```

## Step 3: Set Environment Variables in Cloudflare

Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > Workers & Pages > Create Application > Pages:

1. Create a new Pages project named `ranksheet-web`
2. Go to Settings > Environment Variables
3. Add these variables:

| Variable | Value | Environment |
|----------|-------|-------------|
| `SITE_URL` | `https://ranksheet.com` | Production |
| `CMS_PUBLIC_URL` | `https://cms.ranksheet.com` | Production |
| `AMAZON_ASSOCIATE_TAG` | Your affiliate tag (optional) | Production |

## Step 4: Build and Deploy

```bash
# From apps/web directory
pnpm cf:build    # Build for Cloudflare
pnpm cf:deploy   # Deploy to production
```

Or from monorepo root:
```bash
pnpm --filter @ranksheet/web cf:build
pnpm --filter @ranksheet/web cf:deploy
```

## Step 5: Verify Deployment

Visit your deployed URL (shown in deploy output) or configure custom domain:

1. Go to Workers & Pages > ranksheet-web > Custom Domains
2. Add `ranksheet.com` and `www.ranksheet.com`
3. Follow DNS setup instructions

## Local Development

```bash
# Start CMS (required for web to fetch data)
cd apps/cms
docker compose -f docker-compose.dev.yml up -d
pnpm dev

# In another terminal, start Web
cd apps/web
pnpm dev  # Runs on http://localhost:3003
```

## Troubleshooting

### "Missing account_id" error

Ensure `wrangler.jsonc` exists and contains your account ID:
```bash
ls -la apps/web/wrangler.jsonc
```

If missing, copy from template:
```bash
cp apps/web/wrangler.jsonc.example apps/web/wrangler.jsonc
```

### Authentication error during deploy

Login to Cloudflare:
```bash
npx wrangler login
```

Or set API token:
```bash
export CLOUDFLARE_API_TOKEN="your_api_token"
```

Get API token from: https://dash.cloudflare.com/profile/api-tokens

### Build fails

Clear build cache:
```bash
rm -rf apps/web/.next apps/web/.open-next
pnpm --filter @ranksheet/web cf:build
```

### Environment variables not working

Variables set in Cloudflare Dashboard take effect on next deployment. Redeploy:
```bash
pnpm --filter @ranksheet/web cf:deploy
```

## Next Steps

- Set up custom domain in Cloudflare Dashboard
- Configure Cloudflare CDN cache rules
- Enable Web Analytics
- Set up monitoring with Sentry (if configured)

## Security Reminder

**NEVER commit these files:**
- `apps/web/wrangler.jsonc` (contains account_id)
- `apps/web/.env` or `.env.local` (contains secrets)
- `apps/web/.dev.vars` (local development secrets)

See `SECURITY_CHECKLIST.md` for detailed security guidelines.
