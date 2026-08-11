# syntax=docker/dockerfile:1-labs

# The parser directive above is what makes `COPY --parents` available, which is
# how the Node install layer takes every workspace manifest by glob while
# preserving directory structure. A plain `COPY apps/*/package.json apps/`
# flattens them onto one path.

# The NuVs workflow image, published as ghcr.io/virtool/ts-nuvs.
#
# Built from the repo root:
#
#     docker build -f apps/nuvs/Dockerfile .

# SPAdes ships no binary release this base can use, so it is compiled here. The
# recipe is `virtool/workflow-nuvs`' Dockerfile verbatim, including the version:
# the assembler decides the contigs, so a different one is a different analysis.
#
# This is by far the longest stage in the build and its inputs never change, so
# it is first and depends on nothing else — a source edit anywhere in the repo
# reuses the cached layer.
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

# The Node half. Mirrors the install layer in the repo-root Dockerfile rather
# than sharing it, because that one is Alpine and this image has to be Debian —
# see the note on the runtime stage below.
FROM node:24-bookworm-slim AS node-base
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile
COPY packages/tsconfig.base.json ./packages/
COPY packages/bio ./packages/bio
COPY packages/contracts ./packages/contracts
COPY packages/logger ./packages/logger
COPY packages/sentry ./packages/sentry
COPY packages/storage ./packages/storage
COPY packages/workflow ./packages/workflow
COPY apps/tsconfig.node.json ./apps/

FROM node-base AS build-workflow
COPY apps/nuvs ./apps/nuvs
RUN pnpm --filter @virtool/nuvs build \
    && pnpm deploy --filter @virtool/nuvs --prod /prod/nuvs

# The base is Debian, and that is settled rather than a choice. The runtime
# copies binaries from ghcr.io/virtool/tools, which are built against
# python:3.13-bookworm; musl cannot load them.
FROM node:24-bookworm-slim AS nuvs
WORKDIR /workflow

# Each package here backs a specific runtime dependency of a copied binary.
# perl and libgomp1 are for bowtie2, which is a set of Perl wrappers around
# OpenMP-compiled binaries. libbz2-1.0 is for SPAdes, which links it.
#
# **python3 is for SPAdes, not for us.** `spades.py` is a Python script that
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

COPY --from=build-workflow /prod/nuvs ./

# Exec form, and `node` directly rather than `npm start`: npm does not forward
# signals to the process it spawns (npm/rfcs#829, still open), so SIGTERM would
# never reach the run's handler and a drained node would SIGKILL a job mid-step
# instead of reporting 124.
CMD ["node", "dist/index.mjs"]
