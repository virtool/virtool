# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS internal
WORKDIR /internal
ENV NODE_ENV="production"
COPY package.json ./
COPY node_modules ./node_modules
COPY dist ./dist
COPY node_modules/@virtool/data/drizzle ./drizzle
EXPOSE 9950 9900
ENV VT_JOBS_API_HOST="0.0.0.0"
ENV VT_JOBS_API_PORT="9950"
ENV VT_TASKS_PROBE_PORT="9900"
ENTRYPOINT ["node", "--import", "@sentry/node/import", "dist/index.mjs"]
CMD ["serve"]
