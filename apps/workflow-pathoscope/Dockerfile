# syntax=docker/dockerfile:1-labs

# The parser directive above is what makes `COPY --parents` available, which is
# how the Node install layer takes every workspace manifest by glob while
# preserving directory structure. A plain `COPY apps/*/package.json apps/`
# flattens them onto one path.

# The pathoscope workflow image, published as ghcr.io/virtool/ts-pathoscope.
#
# Built from the repo root: the Rust core lives in packages/pathoscope-core and
# is compiled here rather than released separately, so the binary and its only
# consumer share one artifact and one version.
#
#     docker build -f apps/workflow-pathoscope/Dockerfile .

# The base is Debian, and that is settled rather than a choice. The runtime
# copies binaries from ghcr.io/virtool/tools, which are built against
# python:3.13-bookworm, so the Rust core has to be an ordinary glibc build.
# Do not move this to an Alpine base — rust-htslib's musl support is unverified
# and the tools binaries would not run anyway.
FROM rust:1.97-bookworm AS chef

# libclang-dev is REQUIRED, not optional. hts-sys 2.2.x runs bindgen 0.69
# against htslib's headers for x86_64-unknown-linux-gnu; it does not fall back
# to the pre-generated bindings that ship for some targets. Dropping this
# package fails the build with "Unable to find libclang". Verified empirically
# on 2026-08-04 by building with it absent.
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

# Dependencies only. hts-sys vendors htslib's C source and compiles it with the
# cc crate — by far the most expensive step in the build, and one that changes
# essentially never. Cooking it in its own layer is what keeps a .rs edit from
# recompiling htslib.
RUN cargo chef cook --release --recipe-path recipe.json

COPY packages/pathoscope-core .
RUN cargo build --release --bin pathoscope-core

# The Node half. Mirrors the install layer in the repo-root Dockerfile rather
# than sharing it, because that one is Alpine and this image has to be Debian —
# see the note on the Rust base above.
FROM node:24-bookworm-slim AS node-base
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN pnpm install --frozen-lockfile
COPY packages/tsconfig.base.json ./packages/
COPY packages/contracts ./packages/contracts
COPY packages/logger ./packages/logger
COPY packages/sentry ./packages/sentry
COPY packages/storage ./packages/storage
COPY packages/workflow ./packages/workflow
COPY apps/tsconfig.node.json ./apps/

FROM node-base AS build-workflow
COPY apps/workflow-pathoscope ./apps/workflow-pathoscope
RUN pnpm --filter @virtool/workflow-pathoscope build \
    && pnpm deploy --filter @virtool/workflow-pathoscope --prod /prod/workflow-pathoscope

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

# Exactly one binary out of the whole Rust build. It is a fifth subprocess
# beside bowtie2, bowtie2-build, cd-hit-est and samtools — never loaded into the
# Node process. There is no FFI here and adding one is out of scope by decision.
COPY --from=builder /build/target/release/pathoscope-core /usr/local/bin/

COPY --from=build-workflow /prod/workflow-pathoscope ./

# Exec form, and `node` directly rather than `npm start`: npm does not forward
# signals to the process it spawns (npm/rfcs#829, still open), so SIGTERM would
# never reach the run's handler and a drained node would SIGKILL a job mid-step
# instead of reporting 124.
CMD ["node", "dist/index.mjs"]
