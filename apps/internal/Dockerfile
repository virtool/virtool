# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS internal
WORKDIR /internal
COPY . ./
COPY node_modules/@virtool/data/drizzle ./drizzle
EXPOSE 9950 9900
ENV VT_JOBS_API_HOST="0.0.0.0"
ENV VT_JOBS_API_PORT="9950"
ENV VT_TASKS_PROBE_PORT="9900"
ENTRYPOINT ["node", "--import", "@sentry/node/preload", "dist/index.mjs"]
CMD ["serve"]
