FROM python:3.12-bookworm AS build
RUN curl -sSL https://install.python-poetry.org | python -
ENV PATH="/root/.local/bin:${PATH}" \
    POETRY_CACHE_DIR='/tmp/poetry_cache' \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1
WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN poetry install --without dev --no-root
COPY . ./
RUN poetry install --only-root

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