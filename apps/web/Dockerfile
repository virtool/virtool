# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c AS dist
WORKDIR /ui
ENV NODE_ENV="production"
COPY .output ./.output
COPY package.json ./package.json
EXPOSE 9900
ENV HOST="0.0.0.0"
ENV PORT="9900"
CMD ["npm", "start"]
