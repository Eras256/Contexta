# syntax=docker/dockerfile:1
# Multi-stage build for the Contexta API. Build context MUST be the repo root:
#   fly deploy --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
# (run from the monorepo root so workspace packages are in scope).

# ── Base ─────────────────────────────────────────────────────────────────────
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.6.0 --activate
WORKDIR /app

# ── Dependencies (cached on lockfile + manifests) ────────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* .npmrc ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/tests/package.json packages/tests/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile=false

# ── Build ────────────────────────────────────────────────────────────────────
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @contexta/config build \
    && pnpm --filter @contexta/shared build \
    && pnpm --filter @contexta/tests build \
    && pnpm --filter @contexta/api build

# Prune to production dependencies for a lean runtime image.
RUN pnpm --filter @contexta/api deploy --prod --legacy /app/pruned

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Drop privileges.
USER node
COPY --chown=node:node --from=build /app/pruned/node_modules ./node_modules
COPY --chown=node:node --from=build /app/apps/api/dist ./dist
COPY --chown=node:node --from=build /app/packages/shared/dist ./node_modules/@contexta/shared/dist
COPY --chown=node:node --from=build /app/packages/config/dist ./node_modules/@contexta/config/dist
# @contexta/tests ships the DeFindex/Blend mocks that the API imports at runtime
# (mock mode), so its compiled output must be present in the production image.
COPY --chown=node:node --from=build /app/packages/tests/dist ./node_modules/@contexta/tests/dist

EXPOSE 8080
# Optional release step (DB migrations) is run via Fly's [deploy] release_command,
# not here, so the runtime image stays minimal.
CMD ["node", "dist/index.js"]
