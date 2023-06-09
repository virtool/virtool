FROM library/python:3.10-buster as server
WORKDIR /build
RUN curl -sSL https://install.python-poetry.org | python -
COPY poetry.lock pyproject.toml ./
RUN /root/.local/bin/poetry export --without-hashes > requirements.txt
RUN pip install --user -r requirements.txt
COPY . .
RUN pip install --user .

FROM ghcr.io/virtool/workflow-tools:2.0.1
WORKDIR /virtool
COPY --from=server /root/.local /root/.local
COPY alembic.ini poetry.lock pyproject.toml run.py VERSION* /virtool/
COPY virtool /virtool/virtool
COPY assets /virtool/assets
EXPOSE 9950
ENTRYPOINT ["adev runserver", "run.py"]
CMD ["server"]
