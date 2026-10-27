# syntax=docker/dockerfile:1-labs

# The development image for web, internal, and dev-tools. Compose mounts their
# sources over the copies below. Shipped images build from each app's own
# Dockerfile instead.
#
# `COPY --parents` takes every workspace manifest by glob and keeps the
# directory structure, so adding a workspace does not mean editing this file.
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS dev
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile
COPY biome.json ./
# Copied per package rather than as a blanket `COPY packages ./packages`, so a
# Rust crate edit does not bust this layer's cache. Add a line here when a new
# TypeScript package appears.
COPY packages/tsconfig ./packages/tsconfig
COPY packages/archive ./packages/archive
COPY packages/bio ./packages/bio
COPY packages/contracts ./packages/contracts
COPY packages/data ./packages/data
COPY packages/logger ./packages/logger
COPY packages/ncbi ./packages/ncbi
COPY packages/sentry ./packages/sentry
COPY packages/service ./packages/service
COPY packages/sqlite ./packages/sqlite
COPY packages/storage ./packages/storage
COPY packages/workflow ./packages/workflow
COPY apps/web ./apps/web
COPY apps/internal ./apps/internal
COPY apps/dev-tools ./apps/dev-tools
# The development web process runs with the source owner's UID, which cannot
# read root's Corepack cache. Keep the downloaded package manager readable.
RUN mkdir -p /opt/corepack \
    && cp -a /root/.cache/node/corepack/. /opt/corepack/ \
    && chmod -R a+rX /opt/corepack
ENV COREPACK_HOME=/opt/corepack
