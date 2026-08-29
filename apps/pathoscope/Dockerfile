# syntax=docker/dockerfile:1
FROM workflow-tools AS tools
FROM node:24-bookworm-slim AS pathoscope
WORKDIR /workflow
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libcurl4 libgomp1 libncursesw6 perl pigz python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
COPY --from=tools /usr/local/bin/ /usr/local/bin/
COPY . ./
CMD ["node", "dist/index.mjs"]
