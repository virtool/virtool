FROM python:3.12-bookworm AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . ./
RUN uv sync --frozen --no-dev

FROM python:3.12-bookworm AS version
COPY .git .
RUN <<EOF
git describe --tags | awk -F - '
  {
    version = $1
    if (length($3) > 0) {
      version = version "-pre+g" $3
    }
    print version
  }' > VERSION
EOF


FROM python:3.12-bookworm AS runtime
WORKDIR /app
ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"
COPY --from=ghcr.io/virtool/workflow-tools:2.0.1 /usr/local/bin/bowtie* /usr/local/bin/
COPY --from=build /app/.venv /app/.venv
COPY alembic.ini ./
COPY --from=version /VERSION .
COPY assets ./assets
COPY virtool ./virtool
COPY --chmod=0755 assets/bowtie2-inspect /usr/local/bin/bowtie2-inspect
EXPOSE 9950
ENTRYPOINT ["virtool"]
CMD ["server"]