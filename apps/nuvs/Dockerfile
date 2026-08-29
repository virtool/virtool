# syntax=docker/dockerfile:1
FROM workflow-tools AS tools
FROM node:24-bookworm-slim AS nuvs
WORKDIR /workflow
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libbz2-1.0 libgomp1 perl pigz python3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean
COPY --from=tools /usr/local/bin/ /usr/local/bin/
COPY --from=tools /opt/hmmer /opt/hmmer
COPY --from=tools /opt/spades /opt/spades
ENV PATH="/opt/hmmer/bin:/opt/spades/bin:${PATH}"
COPY . ./
CMD ["node", "dist/index.mjs"]
