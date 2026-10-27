# syntax=docker/dockerfile:1

FROM debian:bookworm AS bowtie2
WORKDIR /build
RUN apt-get update && apt-get install -y build-essential perl wget zlib1g-dev && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/BenLangmead/bowtie2/archive/refs/tags/v2.5.4.tar.gz \
    && tar -xf v2.5.4.tar.gz
WORKDIR /build/bowtie2-2.5.4
RUN make -j"$(nproc)" && mkdir -p /tools/bowtie2/2.5.4 && cp bowtie2* /tools/bowtie2/2.5.4

FROM debian:bookworm AS cd-hit
WORKDIR /build
RUN apt-get update && apt-get install -y build-essential libz-dev wget && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/weizhongli/cdhit/releases/download/V4.8.1/cd-hit-v4.8.1-2019-0228.tar.gz \
    && tar -xf cd-hit-v4.8.1-2019-0228.tar.gz
WORKDIR /build/cd-hit-v4.8.1-2019-0228
RUN sed -i 's/LDFLAGS += -lz -o/LDFLAGS += -Wl,-Bstatic -lgomp -Wl,-Bdynamic -lz -o/' Makefile \
    && make && mkdir -p /tools/cd-hit/4.8.1 && cp -r cd-hit* /tools/cd-hit/4.8.1

FROM debian:bookworm AS hmmer
WORKDIR /build
RUN apt-get update && apt-get install -y bioperl build-essential wget && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 http://eddylab.org/software/hmmer/hmmer-3.3.2.tar.gz && tar -xf hmmer-3.3.2.tar.gz
WORKDIR /build/hmmer-3.3.2
RUN ./configure --prefix /tools/hmmer/3.3.2 && make -j"$(nproc)" && make install

FROM debian:bookworm AS samtools
WORKDIR /build
RUN apt-get update && apt-get install -y build-essential libbz2-dev libcurl4-openssl-dev liblzma-dev libncurses5-dev libncursesw5-dev wget zlib1g-dev && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/samtools/samtools/releases/download/1.22.1/samtools-1.22.1.tar.bz2 && tar -xjf samtools-1.22.1.tar.bz2
WORKDIR /build/samtools-1.22.1
RUN ./configure --prefix=/tools/samtools/1.22.1 && make -j"$(nproc)" && make install

FROM debian:bookworm AS seqkit
WORKDIR /build
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/shenwei356/seqkit/releases/download/v2.13.0/seqkit_linux_amd64.tar.gz \
    && tar -xf seqkit_linux_amd64.tar.gz && chmod ugo+x seqkit

# Bullseye is archived, so this build-only stage uses the final snapshot
# advertised by the base image.
FROM debian:bullseye AS skewer
WORKDIR /build
RUN printf '%s\n' \
        'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20260824T000000Z bullseye main' \
        'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/20260824T000000Z bullseye-security main' \
        > /etc/apt/sources.list \
    && apt-get update && apt-get install -y build-essential wget && rm -rf /var/lib/apt/lists/*
RUN wget -q --tries=3 --timeout=30 https://github.com/relipmoc/skewer/archive/0.2.2.tar.gz && tar -xf 0.2.2.tar.gz
WORKDIR /build/skewer-0.2.2
RUN make

FROM rust:1.97-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /build

FROM chef AS pathoscope-planner
RUN apt-get update && apt-get install -y --no-install-recommends libclang-dev && rm -rf /var/lib/apt/lists/*
COPY packages/pathoscope-core .
RUN cargo chef prepare --recipe-path recipe.json

FROM pathoscope-planner AS pathoscope-builder
COPY --from=pathoscope-planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY packages/pathoscope-core .
RUN cargo build --release --bin pathoscope-core

FROM chef AS quality-planner
COPY packages/quality-core .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS quality-builder
COPY --from=quality-planner /build/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY packages/quality-core .
RUN cargo build --release --bin quality-core

FROM python:3.13-bookworm AS spades
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends build-essential cmake libbz2-dev wget zlib1g-dev && rm -rf /var/lib/apt/lists/* && apt-get clean
RUN wget -q --tries=3 --timeout=30 https://github.com/ablab/spades/releases/download/v4.2.0/SPAdes-4.2.0.tar.gz && tar -xzf SPAdes-4.2.0.tar.gz
WORKDIR /build/SPAdes-4.2.0
ENV PREFIX=/build/spades
RUN ./spades_compile.sh
RUN find /build/spades/bin -type f -exec sh -c 'file -b "$1" | grep -q ELF && strip --strip-unneeded "$1"; true' _ {} \; \
    && rm -rf /build/spades/include /build/spades/lib /build/spades/share/spades/biosynthetic_spades_hmms /build/spades/share/spades/coronaspades_hmms /build/spades/share/spades/sewage /build/spades/share/spades/test_dataset /build/spades/share/spades/test_dataset_plasmid

FROM scratch AS create-subtraction
COPY --from=seqkit /build/seqkit /usr/local/bin/seqkit

FROM scratch AS create-sample
COPY --from=quality-builder /build/target/release/quality-core /usr/local/bin/quality-core

FROM scratch AS pathoscope
COPY --from=bowtie2 /tools/bowtie2/2.5.4/bowtie* /usr/local/bin/
COPY --from=cd-hit /tools/cd-hit/4.8.1/cd-hit-est /usr/local/bin/
COPY --from=samtools /tools/samtools/1.22.1/bin/samtools /usr/local/bin/
COPY --from=pathoscope-builder /build/target/release/pathoscope-core /usr/local/bin/

FROM scratch AS nuvs
COPY --from=bowtie2 /tools/bowtie2/2.5.4/bowtie* /usr/local/bin/
COPY --from=skewer /build/skewer-0.2.2/skewer /usr/local/bin/
COPY --from=hmmer /tools/hmmer/3.3.2/ /opt/hmmer/
COPY --from=spades /build/spades /opt/spades
