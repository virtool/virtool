FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/
COPY apps/site/package.json ./apps/site/
COPY packages/bio/package.json ./packages/bio/
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/data/package.json ./packages/data/
COPY packages/logger/package.json ./packages/logger/
COPY packages/sentry/package.json ./packages/sentry/
COPY packages/storage/package.json ./packages/storage/
RUN pnpm install --frozen-lockfile
COPY biome.json ./
# Copied per package rather than as a blanket `COPY packages ./packages`.
# packages/pathoscope-core is a Rust crate with no package.json — it is not a
# pnpm workspace and this image has no use for it, but a blanket copy would
# pull its src/ and Cargo.lock in and bust this layer's cache on every Rust
# edit. Add a line here when a new TypeScript package appears.
COPY packages/tsconfig.base.json ./packages/
COPY packages/bio ./packages/bio
COPY packages/contracts ./packages/contracts
COPY packages/data ./packages/data
COPY packages/logger ./packages/logger
COPY packages/sentry ./packages/sentry
COPY packages/storage ./packages/storage
COPY apps/web ./apps/web

FROM base AS dev

FROM base AS build
# The Sentry Vite plugin uploads source maps only when SENTRY_AUTH_TOKEN is set
# at build time. Mount it as a BuildKit secret so it is available for this RUN
# only and never persists in an image layer. Absent (e.g. local builds, forked
# PRs) the upload gracefully no-ops and the build still succeeds.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm --filter @virtool/web build

FROM node:24-alpine AS dist
WORKDIR /ui
COPY --from=build /repo/apps/web/.output ./.output
COPY --from=build /repo/apps/web/package.json ./package.json
EXPOSE 9900
ENV HOST="0.0.0.0"
ENV PORT="9900"
CMD ["npm", "start"]
