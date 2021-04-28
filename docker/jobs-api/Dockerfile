FROM library/python:3.8-buster as server
WORKDIR /build
COPY ./requirements.txt /requirements.txt
RUN pip install --user -r /requirements.txt

FROM virtool/external-tools:0.2.0
WORKDIR /virtool
COPY --from=server /root/.local /root/.local
COPY ./run.py /virtool/
COPY ./virtool /virtool/virtool
EXPOSE 9950
ENTRYPOINT ["python", "run.py"]
CMD ["jobsAPI"]
