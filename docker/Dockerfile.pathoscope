FROM library/python:3.6-alpine

WORKDIR /app

COPY . /app

# Install external applications
RUN wget https://github.com/BenLangmead/bowtie2/releases/download/v2.3.2/bowtie2-2.3.2-legacy-linux-x86_64.zip && \
    unzip bowtie2-2.3.2-legacy-linux-x86_64.zip && \
    export PATH=${PATH}:${PWD}/bowtie2-2.3.2-legacy

# Install Python packages
RUN pip install --no-cache-dir -r requirements.txt

EXPOSE 9950

CMD ["python", "run.py"]
