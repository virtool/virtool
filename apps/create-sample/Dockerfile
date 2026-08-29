# syntax=docker/dockerfile:1
FROM workflow-tools AS tools
FROM node:24-bookworm-slim AS create-sample
WORKDIR /workflow
RUN apt-get update \
    && apt-get install -y --no-install-recommends pigz \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
COPY --from=tools /usr/local/bin/quality-core /usr/local/bin/
COPY . ./
CMD ["node", "dist/index.mjs"]
