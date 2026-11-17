# syntax=docker/dockerfile:1
FROM app AS build
FROM workflow-tools AS tools
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS pathoscope
WORKDIR /workflow
ENV NODE_ENV="production"
# bowtie2 is a Perl script and needs full `perl`: the slim base ships only
# `perl-base`, which lacks `Sys::Hostname`. bowtie2-build is a Python script that
# imports the standard library, which `python3-minimal` omits. libgomp1 backs
# bowtie2's OpenMP; libcurl4 and libncursesw6 back samtools. pathoscope-core
# links htslib statically and needs none of them. A missing interpreter does
# not fail the build and shows only when a step runs, so check a shebang
# against the pinned tool version, not upstream.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcurl4 libgomp1 libncursesw6 perl pigz python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
COPY --from=tools /usr/local/bin/ /usr/local/bin/
COPY --from=build /deploy/package.json ./
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /deploy/dist ./dist
CMD ["node", "dist/index.mjs"]
