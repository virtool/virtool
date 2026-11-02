# syntax=docker/dockerfile:1
FROM workflow-tools AS tools
FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS pathoscope
WORKDIR /workflow
ENV NODE_ENV="production"
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcurl4 libgomp1 libncursesw6 perl pigz python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
COPY --from=tools /usr/local/bin/ /usr/local/bin/
COPY package.json ./
COPY node_modules ./node_modules
COPY dist ./dist
CMD ["node", "dist/index.mjs"]
