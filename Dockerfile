FROM library/python:3.10-buster as server
WORKDIR /build
RUN pip install --user poetry==1.1.14
COPY pyproject.toml ./pyproject.toml
COPY poetry.lock ./poetry.lock
RUN /root/.local/bin/poetry export --without-hashes > requirements.txt
RUN pip install --user -r requirements.txt
COPY . . 
RUN pip install --user .

FROM virtool/workflow-tools:2.0.1
WORKDIR /virtool
COPY --from=server /root/.local /root/.local
COPY run.py pyproject.toml VERSION* /virtool/
COPY virtool /virtool/virtool
COPY example /virtool/example
EXPOSE 9950
ENTRYPOINT ["python", "run.py"]
CMD ["server"]
