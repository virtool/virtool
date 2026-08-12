#!/usr/bin/env bash
#
# Regenerate the FastQC fixtures in this directory.
#
# The provenance record for `paired_1.fastqc_data.txt` and
# `paired_2.fastqc_data.txt`: this is the script that produced them, and it is
# the only thing that should. Never hand-edit a fixture to match what the parser
# happens to output — that converts a caught divergence into a permanent one.
#
# It runs the real FastQC 0.11.9, from the same `ghcr.io/virtool/tools` image
# and behind the same JRE the workflow's own Dockerfile stage installs, over a
# prefix of the paired example reads. The whole reads file is ~1 GB and its
# report would be no more informative: FastQC's sections are shaped by read
# length and by the presence of each base, not by depth.
#
# Inputs, from `ghcr.io/virtool/examples`:
#
#   reads/paired_large_1.fastq.gz
#     sha256 ba39edb09962d12f711bacb9b30167ca647d12f96b7321888b9d27e51e428253
#   reads/paired_large_2.fastq.gz
#     sha256 af6687e39b9e3382b4b16b67053ec42d4e7f0e445eb029de542324674d1d0467
#
# Usage:
#
#   apps/create-sample/src/fixtures/generate.sh /path/to/examples/data
#
set -euo pipefail

DATA_PATH="${1:?usage: generate.sh <examples-data-path>}"
FIXTURES_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

TOOLS_IMAGE="ghcr.io/virtool/tools:1.3.0"
FASTQC_VERSION="0.11.9"

# Reads taken from the head of each file. Both members of a pair must take the
# same count from the same offset, or the two reports describe different
# fragments.
READS=20000

WORK_PATH="$(mktemp -d)"
trap 'rm -rf "$WORK_PATH"' EXIT

for MATE in 1 2; do
    # `head` closing the pipe leaves `zcat` on SIGPIPE, which `pipefail` would
    # report as a failed pipeline. The line count is checked below instead, so
    # a genuinely short or corrupt input still fails here.
    set +o pipefail
    zcat "${DATA_PATH}/reads/paired_large_${MATE}.fastq.gz" \
        | head -n $((READS * 4)) \
        | gzip -c > "${WORK_PATH}/paired_${MATE}.fq.gz"
    set -o pipefail

    LINES="$(zcat "${WORK_PATH}/paired_${MATE}.fq.gz" | wc -l)"

    if [ "$LINES" -ne $((READS * 4)) ]; then
        echo "mate ${MATE}: expected $((READS * 4)) lines, got ${LINES}" >&2
        exit 1
    fi
done

# The same recipe as the `create-sample` stage in the repo root Dockerfile, so
# generating a fixture also exercises the way the image gets its FastQC.
docker build -t virtool-fastqc-fixtures:local - <<DOCKERFILE
FROM debian:bookworm-slim
RUN apt-get update \\
    && apt-get install -y --no-install-recommends default-jre-headless perl \\
    && rm -rf /var/lib/apt/lists/* \\
    && apt-get clean
COPY --from=${TOOLS_IMAGE} /tools/fastqc/${FASTQC_VERSION}/ /opt/fastqc
RUN chmod ugo+x /opt/fastqc/fastqc
ENV PATH="/opt/fastqc:\${PATH}"
DOCKERFILE

docker run --rm \
    --user "$(id -u):$(id -g)" \
    -v "${WORK_PATH}:/work" \
    virtool-fastqc-fixtures:local \
    sh -c '
        set -eu
        for mate in 1 2; do
            mkdir -p "/work/out/${mate}"
            fastqc -f fastq -o "/work/out/${mate}" --extract "/work/paired_${mate}.fq.gz"
        done
    '

for MATE in 1 2; do
    # `--extract` leaves exactly one report directory per invocation, which is
    # the property `findFastqcDataFile` stands on.
    cp "${WORK_PATH}/out/${MATE}"/*_fastqc/fastqc_data.txt \
        "${FIXTURES_PATH}/paired_${MATE}.fastqc_data.txt"
done

echo "wrote paired_{1,2}.fastqc_data.txt from ${READS} reads of each mate"
