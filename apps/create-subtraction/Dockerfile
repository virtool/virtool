# syntax=docker/dockerfile:1
FROM workflow-tools AS tools
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS create-subtraction
WORKDIR /workflow
ENV NODE_ENV="production"
RUN apt-get update \
    && apt-get install -y --no-install-recommends pigz \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
COPY --from=tools /usr/local/bin/seqkit /usr/local/bin/
COPY . ./
CMD ["node", "dist/index.mjs"]
