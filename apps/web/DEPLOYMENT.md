# RankSheet Web Deployment (Cloudflare)

The web app is a Next.js App Router site deployed to Cloudflare using OpenNext.

## Initial Setup

### 1. Configure Wrangler

Create your local `wrangler.jsonc` from the example template:

```bash
cd apps/web
cp wrangler.jsonc.example wrangler.jsonc
```

Edit `wrangler.jsonc` and add your Cloudflare account ID:

```jsonc
{
  // ... other config ...
  "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID"
}
```

**Get your Account ID:**
1. Visit https://dash.cloudflare.com/
2. Click on your account name
3. Copy the Account ID from the sidebar

**IMPORTANT:** `wrangler.jsonc` is git-ignored. Never commit it with real credentials.

### 2. Set Environment Variables

Set these in Cloudflare Dashboard (Workers & Pages > Your Project > Settings > Environment Variables):

- `SITE_URL=https://ranksheet.com`
- `CMS_PUBLIC_URL=https://cms.ranksheet.com`
- `AMAZON_ASSOCIATE_TAG=...` (optional)

## Build & Preview Locally

From repo root:

```bash
pnpm --filter @ranksheet/web cf:build
pnpm --filter @ranksheet/web cf:preview
```

## Deploy to Production

### Using Wrangler CLI

```bash
# Build for Cloudflare
pnpm --filter @ranksheet/web cf:build

# Deploy to production
pnpm --filter @ranksheet/web cf:deploy
```

### Using Wrangler with API Token

If deploying from CI/CD, use environment variables:

```bash
export CLOUDFLARE_ACCOUNT_ID="your_account_id"
export CLOUDFLARE_API_TOKEN="your_api_token"

pnpm --filter @ranksheet/web cf:deploy
```

**Get your API Token:**
1. Visit https://dash.cloudflare.com/profile/api-tokens
2. Create Token > Edit Cloudflare Workers template
3. Add permissions: Account.Cloudflare Workers Scripts (Edit)

## Troubleshooting

### Missing account_id error

If you see `Error: Missing account_id`, ensure:
1. `wrangler.jsonc` exists (copied from `wrangler.jsonc.example`)
2. `account_id` field is added with your actual Cloudflare Account ID

### Authentication errors

If deployment fails with auth errors:
1. Run `npx wrangler login` to authenticate locally
2. Or set `CLOUDFLARE_API_TOKEN` environment variable for CI/CD

### Build errors

If `cf:build` fails:
1. Ensure you've run `pnpm install` in the monorepo root
2. Try `pnpm clean` and rebuild
3. Check Next.js compatibility with OpenNext version
