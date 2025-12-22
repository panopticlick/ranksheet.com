# RankSheet.com

Amazon vertical category market ticker application - pnpm monorepo.

## Project Structure

- **`apps/cms`**: Payload CMS 3.68 + Postgres backend (VPS Docker) - `cms.ranksheet.com`
- **`apps/web`**: Next.js 15.5 frontend (Cloudflare Pages) - `ranksheet.com`
- **`packages/shared`**: Shared TypeScript types and Zod schemas

## Quick Start

### Prerequisites

- Node.js 20+ and pnpm 10+
- Docker (for CMS database)
- Cloudflare account (for Web deployment)

### Installation

```bash
# Install dependencies
pnpm install

# Start CMS (local development)
cd apps/cms
docker compose -f docker-compose.dev.yml up -d
cp .env.example .env.local
pnpm db:migrate
pnpm dev  # http://localhost:3006

# Start Web (in another terminal)
cd apps/web
cp .env.example .env.local
pnpm dev  # http://localhost:3003
```

## Deployment

### 🤖 Automated CI/CD (Recommended)

This project uses GitHub Actions for automated deployment:

- **Frontend** → Cloudflare Pages (automatic on push to `apps/web/**`)
- **Backend** → VPS Docker (automatic on push to `apps/cms/**`)

**Setup Steps:**

1. **Configure GitHub Secrets** (required once)
   - Follow the guide: [GITHUB_SECRETS.md](GITHUB_SECRETS.md)
   - Add 8 secrets: Cloudflare tokens, VPS SSH keys, etc.

2. **Push to main branch** - GitHub Actions will automatically deploy

3. **Monitor deployments** - Check the Actions tab for deployment status

See [DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md) for complete CI/CD documentation.

### 📦 Manual Deployment

#### CMS (VPS Docker)

```bash
# Sync code and deploy
rsync -avz --delete --exclude='node_modules' --exclude='.git' \
  ./ root@107.174.42.198:/opt/docker-projects/payload-clusters/payload-cms/ranksheet/ranksheet.com/

ssh root@107.174.42.198
cd /opt/docker-projects/payload-clusters/payload-cms/ranksheet/ranksheet.com/apps/cms
make deploy
```

See `apps/cms/README.md` for detailed instructions.

#### Web (Cloudflare Pages)

```bash
cd apps/web
cp wrangler.jsonc.example wrangler.jsonc
# Edit wrangler.jsonc with your account_id
pnpm cf:build
pnpm cf:deploy
```

See `apps/web/QUICKSTART.md` for step-by-step guide.

**IMPORTANT:** Before deploying, ensure you've:
1. Created `apps/web/wrangler.jsonc` from `wrangler.jsonc.example`
2. Added your Cloudflare Account ID
3. Set environment variables (for manual deployment or in Cloudflare Dashboard)

## Security

**Never commit these files:**
- `apps/web/wrangler.jsonc` (contains account_id)
- `.env` or `.env.local` files (contain secrets)
- `.dev.vars` (local development secrets)

See `apps/web/SECURITY_CHECKLIST.md` for detailed security guidelines.

## Documentation

### Deployment
- **[DEPLOYMENT_SUMMARY.md](DEPLOYMENT_SUMMARY.md)** - Complete deployment overview (CI/CD + manual)
- **[GITHUB_SECRETS.md](GITHUB_SECRETS.md)** - GitHub Secrets configuration guide
- `apps/web/QUICKSTART.md` - 5-minute Cloudflare deployment
- `apps/web/DEPLOYMENT.md` - Detailed frontend deployment
- `apps/web/SECURITY_CHECKLIST.md` - Security best practices
- `apps/cms/README.md` - Backend CMS setup

### Development
- `CLAUDE.md` - AI assistant guidance for this codebase
- Project specifications: `task/ranksheet/:docs/` (V2 Final)
- API documentation: `apps/cms/docs/`

### CI/CD
- `.github/workflows/deploy-web.yml` - Frontend deployment workflow
- `.github/workflows/deploy-cms.yml` - Backend deployment workflow
- `.github/workflows/ci.yml` - Continuous integration checks
- `.github/workflows/docker-security.yml` - Docker security scanning

## Common Commands

```bash
# Development
pnpm dev:cms      # Start CMS
pnpm dev:web      # Start Web

# Build
pnpm build        # Build all packages

# Lint & Type Check
pnpm lint         # Lint all packages
pnpm typecheck    # Type check all packages

# Database (CMS)
cd apps/cms
pnpm db:migrate   # Run migrations
pnpm db:seed      # Seed sample data (dev only)

# Cloudflare (Web)
cd apps/web
pnpm cf:build     # Build for Cloudflare
pnpm cf:deploy    # Deploy to production
```

## License

Proprietary - All rights reserved.
