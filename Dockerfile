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
COPY packages/archive ./packages/archive
COPY packages/bio ./packages/bio
COPY packages/contracts ./packages/contracts
COPY packages/data ./packages/data
COPY packages/logger ./packages/logger
COPY packages/sentry ./packages/sentry
COPY packages/service ./packages/service
COPY packages/sqlite ./packages/sqlite
COPY packages/storage ./packages/storage
COPY packages/workflow ./packages/workflow
COPY apps/tsconfig.node.json ./apps/

# External bioinformatics tools, ported from `ghcr.io/virtool/tools`.
#
# One stage per tool, never one combined stage: BuildKit builds only the stages
# the requested target reaches, so `--target create-subtraction` compiles
# nothing but seqkit. None of them depends on `base` or on the build context, so
# a warm cache skips them all whatever changed in the repo.
#
# Every download passes `--tries` and `--timeout`. wget defaults to 20 tries at
# a 900 s read timeout, so an unreachable mirror does not fail the build — it
# hangs the job until the runner's six-hour ceiling, holding up every other
# pull request behind it. These sources are academic and personal servers, and
# they do go down.

FROM debian:bookworm AS bowtie2
WORKDIR /build
RUN apt-get update \
    && apt-get install -y build-essential perl wget zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/BenLangmead/bowtie2/archive/refs/tags/v2.5.4.tar.gz \
    && tar -xf v2.5.4.tar.gz
WORKDIR /build/bowtie2-2.5.4
RUN make -j"$(nproc)" \
    && mkdir -p /tools/bowtie2/2.5.4 \
    && cp bowtie2* /tools/bowtie2/2.5.4

FROM debian:bookworm AS cd-hit
WORKDIR /build
RUN apt-get update \
    && apt-get install -y build-essential libz-dev wget \
    && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/weizhongli/cdhit/releases/download/V4.8.1/cd-hit-v4.8.1-2019-0228.tar.gz \
    && tar -xf cd-hit-v4.8.1-2019-0228.tar.gz
WORKDIR /build/cd-hit-v4.8.1-2019-0228
# The sed links libgomp statically. Without it the binary needs `libgomp1` in
# whatever image copies it.
RUN sed -i 's/LDFLAGS += -lz -o/LDFLAGS += -Wl,-Bstatic -lgomp -Wl,-Bdynamic -lz -o/' Makefile \
    && make \
    && mkdir -p /tools/cd-hit/4.8.1 \
    && cp -r cd-hit* /tools/cd-hit/4.8.1

# There is deliberately no `fastqc` stage. `packages/quality-core` replaced
# FastQC in the create-sample image and is pinned bit-for-bit against it, so
# nothing in this repo runs the tool — the fixtures taken from it are frozen
# and checked in.

FROM debian:bookworm AS hmmer
WORKDIR /build
RUN apt-get update \
    && apt-get install -y bioperl build-essential wget \
    && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 http://eddylab.org/software/hmmer/hmmer-3.3.2.tar.gz \
    && tar -xf hmmer-3.3.2.tar.gz
WORKDIR /build/hmmer-3.3.2
RUN ./configure --prefix /tools/hmmer/3.3.2 \
    && make -j"$(nproc)" \
    && make install

# There is deliberately no `pigz` stage. The only source for its tarball is
# zlib.net, which goes down often enough to hang every build queued behind it,
# so the stages that want pigz install Debian's package instead. Nothing here
# depends on its exact output bytes — checksums are taken over decompressed
# content — so 2.6 rather than 2.8 costs nothing.

FROM debian:bookworm AS samtools
WORKDIR /build
RUN apt-get update \
    && apt-get install -y \
        build-essential \
        libbz2-dev \
        libcurl4-openssl-dev \
        liblzma-dev \
        libncurses5-dev \
        libncursesw5-dev \
        wget \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/samtools/samtools/releases/download/1.22.1/samtools-1.22.1.tar.bz2 \
    && tar -xjf samtools-1.22.1.tar.bz2
WORKDIR /build/samtools-1.22.1
RUN ./configure --prefix=/tools/samtools/1.22.1 \
    && make -j"$(nproc)" \
    && make install

FROM debian:bookworm AS seqkit
WORKDIR /build
RUN apt-get update \
    && apt-get install -y wget \
    && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/shenwei356/seqkit/releases/download/v2.13.0/seqkit_linux_amd64.tar.gz \
    && tar -xf seqkit_linux_amd64.tar.gz \
    && mkdir -p /tools/seqkit/2.13.0 \
    && mv seqkit /tools/seqkit/2.13.0/seqkit \
    && chmod ugo+x /tools/seqkit/2.13.0/seqkit

# Bullseye, alone in this file: skewer 0.2.2's comparator is non-const, which
# bookworm's GCC 12 rejects outright. The binary is a plain glibc build and runs
# on the bookworm runtime stages unchanged.
FROM debian:bullseye AS skewer
WORKDIR /build
RUN apt-get update \
    && apt-get install -y build-essential wget \
    && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/relipmoc/skewer/archive/0.2.2.tar.gz \
    && tar -xf 0.2.2.tar.gz
WORKDIR /build/skewer-0.2.2
RUN make \
    && mkdir -p /tools/skewer/0.2.2 \
    && mv skewer /tools/skewer/0.2.2/skewer

# The Rust crates, built with cargo-chef so a dependency layer survives a
# source edit. One planner/builder pair per crate, for the same reason the
# tools above get a stage each: a build that reaches one must not compile the
# other.
#
# `chef` carries only what both crates need. libclang is pathoscope-core's
# alone — hts-sys runs bindgen against htslib's headers rather than shipping
# pre-generated bindings — and quality-core links nothing native at all, so it
# would be a wasted apt install in every create-sample build.
FROM rust:1.97-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /build

FROM chef AS chef-pathoscope
RUN apt-get update \
    && apt-get install -y --no-install-recommends libclang-dev \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

FROM chef-pathoscope AS pathoscope-planner
COPY packages/pathoscope-core .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef-pathoscope AS pathoscope-builder
COPY --from=pathoscope-planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY packages/pathoscope-core .
RUN cargo build --release --bin pathoscope-core

FROM chef AS quality-planner
COPY packages/quality-core .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS quality-builder
COPY --from=quality-planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY packages/quality-core .
RUN cargo build --release --bin quality-core

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
COPY --from=seqkit /tools/seqkit/2.13.0/seqkit /usr/local/bin/
COPY --from=build-create-subtraction /prod/create-subtraction ./
CMD ["node", "dist/index.mjs"]

# The create-sample workflow, published as ghcr.io/virtool/ts-create-sample. It
# turns a user's uploaded FASTQ files into a sample an analysis can run against.
FROM base AS build-create-sample
COPY apps/create-sample ./apps/create-sample
RUN pnpm --filter @virtool/create-sample build \
    && pnpm deploy --filter @virtool/create-sample --prod /prod/create-sample

FROM node:24-bookworm-slim AS create-sample
WORKDIR /workflow

# There is deliberately no apt layer here. FastQC forced a JRE and the full
# `perl` into this image — it is a Java program behind a Perl launcher that
# opens with `use FindBin` — and `quality-core` replaced it with one static
# binary that needs nothing the base does not already carry.
COPY --from=quality-builder /build/target/release/quality-core /usr/local/bin/

COPY --from=build-create-sample /prod/create-sample ./
CMD ["node", "dist/index.mjs"]

FROM base AS build-pathoscope
COPY apps/pathoscope ./apps/pathoscope
RUN pnpm --filter @virtool/pathoscope build \
    && pnpm deploy --filter @virtool/pathoscope --prod /prod/pathoscope

FROM node:24-bookworm-slim AS pathoscope
WORKDIR /workflow

# The tools binaries are built on debian:bookworm, which carries more than this
# slim base does. Each package here backs a specific `ldd ... => not found` or
# shebang: libgomp1 for the OpenMP-compiled bowtie2-align-* binaries, libcurl4
# and libncursesw6 for samtools, perl for the `bowtie2` wrapper and python3 for
# the `bowtie2-build` one — both wrappers, different interpreters.
# pathoscope-core itself needs none of them — hts-sys links htslib statically.
#
# pigz is the odd one out: a tool rather than a library something else needs,
# and installed here rather than copied from a stage. The tools block above
# says why.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcurl4 \
        libgomp1 \
        libncursesw6 \
        perl \
        pigz \
        python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

COPY --from=bowtie2 /tools/bowtie2/2.5.4/bowtie* /usr/local/bin/
COPY --from=cd-hit /tools/cd-hit/4.8.1/cd-hit-est /usr/local/bin/
COPY --from=samtools /tools/samtools/1.22.1/bin/samtools /usr/local/bin/
COPY --from=pathoscope-builder /build/target/release/pathoscope-core /usr/local/bin/
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
RUN wget -q --tries=3 --timeout=30 https://github.com/ablab/spades/releases/download/v4.2.0/SPAdes-4.2.0.tar.gz
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
# libgomp1 is for the OpenMP-compiled bowtie2-align-* binaries and libbz2-1.0
# for SPAdes, which links it.
#
# perl and python3 are interpreters rather than libraries, and each is needed
# twice over: perl runs the `bowtie2` wrapper, python3 runs the
# `bowtie2-build` one and `spades.py`, which drives the compiled assembler
# binaries. Dropping either leaves an image whose steps fail at exec with no
# clue why.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libbz2-1.0 \
        libgomp1 \
        perl \
        python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

COPY --from=bowtie2 /tools/bowtie2/2.5.4/bowtie* /usr/local/bin/
COPY --from=skewer /tools/skewer/0.2.2/ /usr/local/bin/
COPY --from=hmmer /tools/hmmer/3.3.2/ /opt/hmmer/
COPY --from=spades /build/spades /opt/spades

# There is deliberately no pigz. Python shells out to it for every compression;
# `@virtool/workflow`'s gzip helpers are `node:zlib` in-process, and checksums
# are taken over decompressed content, so nothing depends on pigz's output.
ENV PATH="/opt/hmmer/bin:/opt/spades/bin:${PATH}"

COPY --from=build-nuvs /prod/nuvs ./

CMD ["node", "dist/index.mjs"]
