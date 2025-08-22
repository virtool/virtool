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


FROM python:3.12-bookworm AS test
WORKDIR /app
ENV VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:/opt/fastqc:/opt/hmmer/bin:$PATH"
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/bowtie2/2.5.4/bowtie* /usr/local/bin/
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/hmmer/3.2.1 /opt/hmmer
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/fastqc/0.11.9 /opt/fastqc
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/pigz/2.8/pigz /usr/local/bin/
COPY assets/skewer /usr/local/bin/skewer
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/samtools/1.22.1/bin/samtools /usr/local/bin/
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
RUN apt-get update && \
    apt-get install -y --no-install-recommends default-jre && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean && \
    chmod ugo+x /opt/fastqc/fastqc
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_CACHE_DIR='/tmp/uv_cache'
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen
COPY . ./

FROM python:3.12-bookworm AS runtime
WORKDIR /app
ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/bowtie2/2.5.4/bowtie* /usr/local/bin/
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/hmmer/3.2.1 /opt/hmmer
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/fastqc/0.11.9 /opt/fastqc
COPY --from=ghcr.io/virtool/tools:1.1.0 /tools/pigz/2.8/pigz /usr/local/bin/
COPY assets/skewer /usr/local/bin/skewer
COPY --from=build /app/.venv /app/.venv
RUN apt-get update && apt-get install -y --no-install-recommends default-jre
COPY alembic.ini ./
COPY --from=version /VERSION .
COPY assets ./assets
COPY virtool ./virtool
COPY --chmod=0755 assets/bowtie2-inspect /usr/local/bin/bowtie2-inspect
EXPOSE 9950
ENTRYPOINT ["virtool"]
CMD ["server"]