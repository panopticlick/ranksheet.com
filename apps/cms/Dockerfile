FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN corepack enable

# Install deps (workspace)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/cms/package.json apps/cms/package.json

RUN pnpm install --frozen-lockfile

# Copy source and build
COPY packages/shared packages/shared
COPY apps/cms apps/cms

RUN pnpm --filter @ranksheet/cms build


FROM node:20-bookworm-slim AS runner

WORKDIR /app
RUN corepack enable

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

# Copy standalone build
COPY --from=builder /app/apps/cms/.next/standalone ./
# Copy static files (required for Next.js standalone)
COPY --from=builder /app/apps/cms/.next/static ./apps/cms/.next/static
# Copy public folder if exists
COPY --from=builder /app/apps/cms/public ./apps/cms/public

WORKDIR /app/apps/cms
EXPOSE 3000

# Run standalone server directly
CMD ["node", "server.js"]

