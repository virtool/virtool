# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS dist
WORKDIR /ui
ENV NODE_ENV="production"
COPY .output ./.output
COPY package.json ./package.json
EXPOSE 9900
ENV HOST="0.0.0.0"
ENV PORT="9900"
CMD ["npm", "start"]
