FROM python:3.6-alpine

WORKDIR /app

ADD . /app

RUN apk add --no-cache build-base python3-dev libffi libffi-dev linux-headers && pip install --no-cache-dir -r requirements.txt

EXPOSE 9950

CMD ["python", "run.py"]
