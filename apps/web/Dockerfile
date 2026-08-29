# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS dist
WORKDIR /ui
COPY .output ./.output
COPY package.json ./package.json
EXPOSE 9900
ENV HOST="0.0.0.0"
ENV PORT="9900"
CMD ["npm", "start"]
