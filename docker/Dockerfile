FROM library/node:14-buster as client
WORKDIR /build
COPY ../client /build/
RUN npm i
RUN npx webpack --config webpack.production.config.babel.js

FROM library/python:3.8-buster as server
WORKDIR /build
COPY ../requirements.txt /requirements.txt
RUN pip install --user -r /requirements.txt

FROM virtool/external-tools:0.2.0
WORKDIR /virtool
COPY --from=client /build/dist /virtool/client
COPY --from=server /root/.local /root/.local
COPY ../run.py /virtool/
COPY ../virtool /virtool/virtool
COPY ../static /virtool/static
COPY ../templates /virtool/templates
EXPOSE 9950
ENTRYPOINT ["python", "run.py"]
CMD ["server"]
