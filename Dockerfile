FROM python:3.8-buster as pip
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs > rustup.rs
RUN sh rustup.rs -y
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs > rustup.rs
RUN sh rustup.rs -y
COPY requirements.txt .
RUN pip install --user -r requirements.txt

FROM node:12 as node
WORKDIR /build
COPY client/.eslintrc /build/
COPY client/babel.config.js /build/
COPY client/package.json /build/
COPY client/package-lock.json /build/
COPY client/webpack.production.config.babel.js /build/
RUN npm i
COPY client/src /build/src
RUN ls
RUN npx webpack --config webpack.production.config.babel.js

FROM virtool/external-tools:0.2.0
WORKDIR /app
COPY --from=pip /root/.local /root/.local
COPY --from=node /build/dist /app/client
COPY static /app/static
COPY templates /app/templates
COPY virtool /app/virtool
COPY run.py /app/
ENV PATH=/root/.local/bin:$PATH
CMD ["python", "run.py", "--host", "0.0.0.0"]
