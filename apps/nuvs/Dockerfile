# syntax=docker/dockerfile:1
FROM workflow-tools AS tools
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS nuvs
WORKDIR /workflow
ENV NODE_ENV="production"
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libbz2-1.0 libgomp1 perl pigz python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
COPY --from=tools /usr/local/bin/ /usr/local/bin/
COPY --from=tools /opt/hmmer /opt/hmmer
COPY --from=tools /opt/spades /opt/spades
ENV PATH="/opt/hmmer/bin:/opt/spades/bin:${PATH}"
COPY package.json ./
COPY node_modules ./node_modules
COPY dist ./dist
CMD ["node", "dist/index.mjs"]
