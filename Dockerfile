FROM library/python:3.6-alpine

WORKDIR /app

COPY . /app

RUN apk add --no-cache build-base python3-dev libffi libffi-dev linux-headers
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 9950

CMD ["python", "run.py"]
