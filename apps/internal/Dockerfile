# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS internal
WORKDIR /internal
ENV NODE_ENV="production"
COPY . ./
COPY node_modules/@virtool/data/drizzle ./drizzle
EXPOSE 9950 9900
ENV VT_JOBS_API_HOST="0.0.0.0"
ENV VT_JOBS_API_PORT="9950"
ENV VT_TASKS_PROBE_PORT="9900"
ENTRYPOINT ["node", "--import", "@sentry/node/import", "dist/index.mjs"]
CMD ["serve"]
