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

FROM node:24-bookworm-slim AS base
WORKDIR /app

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

# Exactly one binary out of the whole Rust build.
COPY --from=builder /build/target/release/pathoscope-core /usr/local/bin/
