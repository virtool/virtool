FROM virtool/external-tools:0.2.0

WORKDIR virtool

ADD . .

RUN ls

RUN pip install -qr requirements.txt


RUN ls -l

ENTRYPOINT ["pytest"]