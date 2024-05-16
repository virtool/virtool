FROM python:3.12-bookworm as build
RUN curl -sSL https://install.python-poetry.org | python - --version 1.7.1
ENV PATH="/root/.local/bin:${PATH}" \
    POETRY_CACHE_DIR='/tmp/poetry_cache' \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_IN_PROJECT=1 \
    POETRY_VIRTUALENVS_CREATE=1
WORKDIR /app
COPY poetry.lock pyproject.toml ./
RUN poetry install --without dev --no-root && rm -rf "$POETRY_CACHE_DIR"

FROM python:3.12-bookworm as version
COPY .git .
RUN git describe --tags #This line is for testing ONLY remove before merge
RUN git describe --tags  > VERSION

FROM python:3.12-bookworm as runtime
WORKDIR /app
ENV VIRTUAL_ENV=/app/.venv \
    PATH="/app/.venv/bin:$PATH"
COPY --from=ghcr.io/virtool/workflow-tools:2.0.1 /usr/local/bin/bowtie* /usr/local/bin/
COPY --from=build /app/.venv /app/.venv
COPY alembic.ini run.py ./
COPY --from=version /VERSION .
COPY assets ./assets
COPY virtool ./virtool
COPY assets/bowtie2-inspect /user/local/bin/bowtie2-inspect

EXPOSE 9950
ENTRYPOINT ["python", "run.py"]
CMD ["server"]