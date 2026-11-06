# syntax=docker/dockerfile:1

# Builds one app from the repository root. Bake links each app's build target
# into its Dockerfile as the `app` context, and the runtime stage copies only
# what it runs.

FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS base
ENV CI="true"
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT="0"
RUN corepack enable pnpm
WORKDIR /repo

# The install layer depends only on the manifests and the lockfile, so a source
# change reuses it.
FROM base AS install
ARG APP
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "${APP}..."

# A secret does not change the cache key. A release passes `RELEASE`, so its
# build does not reuse a layer that ran without the Sentry token. The release
# also names the Sentry release, because the context has no Git history.
FROM install AS build
ARG APP
ARG RELEASE
COPY . .
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
    if [ -n "${RELEASE}" ]; then export SENTRY_RELEASE="${RELEASE}"; fi \
    && pnpm --filter "${APP}" build

# `pnpm deploy` packs only what the `files` field of an app lists, so each
# bundled app sets `"files": ["dist"]`. Without it, the deployed tree has the
# dependencies and none of the code.
FROM build AS deploy
ARG APP
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter "${APP}" --prod deploy --store-dir /pnpm/store /deploy
