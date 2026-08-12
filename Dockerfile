# syntax=docker/dockerfile:1-labs

# The parser directive above is what makes `COPY --parents` available, which is
# how the install layer takes every workspace manifest by glob while preserving
# directory structure. A plain `COPY apps/*/package.json apps/` flattens them
# all onto one path. Adding a workspace must not mean editing this file.
#
# Every stage in this repo is Debian. Do not add an Alpine stage.
FROM node:24-bookworm-slim AS base
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile
COPY biome.json ./
# Copied per package rather than as a blanket `COPY packages ./packages`.
# packages/pathoscope-core is a Rust crate with no package.json — it is not a
# pnpm workspace, and a blanket copy would pull its src/ and Cargo.lock in and
# bust this layer's cache on every Rust edit. Add a line here when a new
# TypeScript package appears.
COPY packages/tsconfig.base.json ./packages/
COPY packages/bio ./packages/bio
COPY packages/contracts ./packages/contracts
COPY packages/data ./packages/data
COPY packages/logger ./packages/logger
COPY packages/sentry ./packages/sentry
COPY packages/service ./packages/service
COPY packages/storage ./packages/storage
COPY packages/workflow ./packages/workflow
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
# only and never persists in an image layer.
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm --filter @virtool/web build

FROM node:24-bookworm-slim AS dist
WORKDIR /ui
COPY --from=build-web /repo/apps/web/.output ./.output
COPY --from=build-web /repo/apps/web/package.json ./package.json
EXPOSE 9900
ENV HOST="0.0.0.0"
ENV PORT="9900"
CMD ["npm", "start"]

FROM base AS build-jobs-api
COPY apps/jobs-api ./apps/jobs-api
RUN pnpm --filter @virtool/jobs-api build \
    && pnpm deploy --filter @virtool/jobs-api --prod /prod/jobs-api

FROM node:24-bookworm-slim AS jobs-api
WORKDIR /jobs-api
COPY --from=build-jobs-api /prod/jobs-api ./
EXPOSE 9950
ENV VT_JOBS_API_HOST="0.0.0.0"
ENV VT_JOBS_API_PORT="9950"

# Installs Sentry's module hooks before any application import is evaluated.
# Without it the app's own static imports resolve before `Sentry.init` runs.
CMD ["node", "--import", "@sentry/node/preload", "dist/index.mjs"]

FROM base AS build-tasks
COPY apps/tasks ./apps/tasks
RUN pnpm --filter @virtool/tasks build \
    && pnpm deploy --filter @virtool/tasks --prod /prod/tasks

FROM node:24-bookworm-slim AS tasks
WORKDIR /tasks
COPY --from=build-tasks /prod/tasks ./
EXPOSE 9900
ENV VT_TASKS_PROBE_PORT="9900"
CMD ["node", "--import", "@sentry/node/preload", "dist/index.mjs"]

FROM base AS build-create-subtraction
COPY apps/create-subtraction ./apps/create-subtraction
RUN pnpm --filter @virtool/create-subtraction build \
    && pnpm deploy --filter @virtool/create-subtraction --prod /prod/create-subtraction

FROM node:24-bookworm-slim AS create-subtraction
WORKDIR /workflow
COPY --from=ghcr.io/virtool/tools:1.3.0 /tools/seqkit/2.13.0/seqkit /usr/local/bin/
COPY --from=build-create-subtraction /prod/create-subtraction ./
CMD ["node", "dist/index.mjs"]

FROM rust:1.97-bookworm AS chef
RUN apt-get update \
    && apt-get install -y --no-install-recommends libclang-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
RUN cargo install cargo-chef --locked
WORKDIR /build

FROM chef AS planner
COPY packages/pathoscope-core .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY packages/pathoscope-core .
RUN cargo build --release --bin pathoscope-core

FROM base AS build-pathoscope
COPY apps/pathoscope ./apps/pathoscope
RUN pnpm --filter @virtool/pathoscope build \
    && pnpm deploy --filter @virtool/pathoscope --prod /prod/pathoscope

FROM node:24-bookworm-slim AS pathoscope
WORKDIR /workflow

# The tools binaries are built against python:3.13-bookworm, which carries more
# than this slim base does. Each package here backs a specific `ldd ... => not
# found`: perl and libgomp1 for bowtie2 (a set of Perl wrappers around the
# bowtie2-align-* binaries, compiled with OpenMP), libcurl4 and libncursesw6
# for samtools. pathoscope-core itself needs none of them — hts-sys links
# htslib statically.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcurl4 \
        libgomp1 \
        libncursesw6 \
        perl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

COPY --from=ghcr.io/virtool/tools:1.2.0 /tools/bowtie2/2.5.4/bowtie* /usr/local/bin/
COPY --from=ghcr.io/virtool/tools:1.2.0 /tools/cd-hit/4.8.1/cd-hit-est /usr/local/bin/
COPY --from=ghcr.io/virtool/tools:1.2.0 /tools/pigz/2.8/pigz /usr/local/bin/
COPY --from=ghcr.io/virtool/tools:1.2.0 /tools/samtools/1.22.1/bin/samtools /usr/local/bin/
COPY --from=builder /build/target/release/pathoscope-core /usr/local/bin/
COPY --from=build-pathoscope /prod/pathoscope ./
CMD ["node", "dist/index.mjs"]

# The NuVs workflow, published as ghcr.io/virtool/ts-nuvs. It finds viruses the
# reference does not describe, by discarding reads that map to a known OTU or a
# subtraction, assembling what is left with SPAdes and searching the contigs
# for viral motifs with HMMER.
#
# SPAdes ships no binary release this base can use, so it is compiled here.
# The recipe is `virtool/workflow-nuvs`'s Dockerfile verbatim, including the
# version: the assembler decides the contigs, so a different one is a
# different analysis. It depends on nothing else in this file, so a warm layer
# cache skips it regardless of what else changed.
FROM python:3.13-bookworm AS spades
WORKDIR /build
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        cmake \
        libbz2-dev \
        wget \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
RUN wget -q https://github.com/ablab/spades/releases/download/v4.2.0/SPAdes-4.2.0.tar.gz
RUN tar -xzf SPAdes-4.2.0.tar.gz
WORKDIR /build/SPAdes-4.2.0
ENV PREFIX=/build/spades
RUN ./spades_compile.sh

FROM base AS build-nuvs
COPY apps/nuvs ./apps/nuvs
RUN pnpm --filter @virtool/nuvs build \
    && pnpm deploy --filter @virtool/nuvs --prod /prod/nuvs

FROM node:24-bookworm-slim AS nuvs
WORKDIR /workflow

# Each package here backs a specific runtime dependency of a copied binary.
# perl and libgomp1 are for bowtie2, a set of Perl wrappers around
# OpenMP-compiled binaries. libbz2-1.0 is for SPAdes, which links it.
#
# python3 is for SPAdes, not for us: `spades.py` is a Python script that
# drives the compiled assembler binaries — dropping it leaves an image whose
# `assemble` step fails at exec with no clue why.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libbz2-1.0 \
        libgomp1 \
        perl \
        python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

COPY --from=ghcr.io/virtool/tools:1.2.0 /tools/bowtie2/2.5.4/bowtie* /usr/local/bin/
COPY --from=ghcr.io/virtool/tools:1.2.0 /tools/skewer/0.2.2/ /usr/local/bin/
COPY --from=ghcr.io/virtool/tools:1.2.0 /tools/hmmer/3.3.2/ /opt/hmmer/
COPY --from=spades /build/spades /opt/spades

# There is deliberately no pigz. Python shells out to it for every compression;
# `@virtool/workflow`'s gzip helpers are `node:zlib` in-process, and checksums
# are taken over decompressed content, so nothing depends on pigz's output.
ENV PATH="/opt/hmmer/bin:/opt/spades/bin:${PATH}"

COPY --from=build-nuvs /prod/nuvs ./

CMD ["node", "dist/index.mjs"]
