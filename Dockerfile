# syntax=docker/dockerfile:1-labs

# The parser directive above is what makes `COPY --parents` available, which is
# how the install layer takes every workspace manifest by glob while preserving
# directory structure. A plain `COPY apps/*/package.json apps/` flattens them
# all onto one path. Adding a workspace must not mean editing this file.
FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY --parents apps/*/package.json packages/*/package.json ./
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

# The Node-app tsconfig base every non-Vite app extends. A fixed path, so it
# needs no edit when an app is added — unlike the per-workspace manifest list it
# replaced.
COPY apps/tsconfig.node.json ./apps/

# App source is copied by each build stage rather than here, so a change to one
# app does not invalidate another's cache, and so adding an app never touches
# the install layer above.

FROM base AS dev
COPY apps/web ./apps/web

FROM base AS build-web
COPY apps/web ./apps/web
# The Sentry Vite plugin uploads source maps only when SENTRY_AUTH_TOKEN is set
# at build time. Mount it as a BuildKit secret so it is available for this RUN
# only and never persists in an image layer. Absent (e.g. local builds, forked
# PRs) the upload gracefully no-ops and the build still succeeds.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm --filter @virtool/web build

# Named `dist` rather than `web` because tooling outside this repo targets it.
FROM node:24-alpine AS dist
WORKDIR /ui
COPY --from=build-web /repo/apps/web/.output ./.output
COPY --from=build-web /repo/apps/web/package.json ./package.json
EXPOSE 9900
ENV HOST="0.0.0.0"
ENV PORT="9900"
CMD ["npm", "start"]

# Non-Vite apps bundle to a single `dist/index.mjs` with their workspace
# packages inlined, then `pnpm deploy` materialises the externals the bundle
# still imports — `injectWorkspacePackages: true` in pnpm-workspace.yaml is what
# lets it resolve `workspace:*` dependencies rather than refusing.

FROM base AS build-jobs-api
COPY apps/jobs-api ./apps/jobs-api
RUN pnpm --filter @virtool/jobs-api build \
    && pnpm deploy --filter @virtool/jobs-api --prod /prod/jobs-api

# The control plane needs no bioinformatics tools, so it stays on Alpine. The
# Debian base below is a cost paid only to satisfy the tools binaries.
FROM node:24-alpine AS jobs-api
WORKDIR /jobs-api
COPY --from=build-jobs-api /prod/jobs-api ./
EXPOSE 9950
ENV VT_JOBS_API_HOST="0.0.0.0"
ENV VT_JOBS_API_PORT="9950"
CMD ["node", "dist/index.mjs"]

FROM base AS build-create-subtraction
COPY apps/create-subtraction ./apps/create-subtraction
RUN pnpm --filter @virtool/create-subtraction build \
    && pnpm deploy --filter @virtool/create-subtraction --prod /prod/create-subtraction

# Debian, not Alpine: the tools binaries are built against `python:3.13-bookworm`
# and are dynamically linked against glibc, which musl cannot load. The deploy
# tree is built on Alpine above, which is safe only because it carries no native
# addon — check `find /prod/<app> -name '*.node'` before adding a dependency that
# does.
FROM node:24-bookworm-slim AS create-subtraction
WORKDIR /workflow
# Not every tool in that image is a binary. `bowtie2-build` is a python3 script
# wrapping the real `bowtie2-build-s` / `bowtie2-build-l`, choosing between them
# by index size, and `bowtie2` is a perl one. An interpreter or two in a
# TypeScript workflow image reads oddly, but the alternative is porting
# bowtie2's own size heuristic, which belongs with the workflow rather than with
# its base image.
#
# Neither can be trimmed. `python3-minimal` omits the stdlib, and
# `bowtie2-build` dies on `import gzip`; the base's `perl-base` omits
# `Sys::Hostname`, which `bowtie2` needs. Install the full packages.
RUN apt-get update \
    && apt-get install -y --no-install-recommends perl python3 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/virtool/tools /tools/bowtie2/2.5.4 /tools/bowtie2/2.5.4
COPY --from=ghcr.io/virtool/tools /tools/pigz/2.8 /tools/pigz/2.8
ENV PATH="/tools/bowtie2/2.5.4:/tools/pigz/2.8:${PATH}"
COPY --from=build-create-subtraction /prod/create-subtraction ./
CMD ["node", "dist/index.mjs"]
