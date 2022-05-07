FROM library/python:3.8-buster as server
WORKDIR /build
RUN pip install --user poetry
COPY pyproject.toml ./pyproject.toml
COPY poetry.lock ./poetry.lock
RUN /root/.local/bin/poetry export --without-hashes > requirements.txt
RUN pip install --user -r requirements.txt
COPY . . 
RUN pip install --user .

FROM virtool/external-tools:0.2.0
WORKDIR /virtool
COPY --from=server /root/.local /root/.local
COPY run.py VERSION* /virtool/
COPY virtool /virtool/virtool
COPY example /virtool/example
EXPOSE 9950
ENTRYPOINT ["python", "run.py"]
CMD ["server"]
