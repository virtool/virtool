import zlib
from collections.abc import AsyncIterable, AsyncIterator, Mapping
from typing import Any

from virtool.api.custom_json import dump_bytes


async def iter_compressed_reference_ndjson(
    reference: Mapping[str, Any],
    otus: AsyncIterable[Mapping[str, Any]],
) -> AsyncIterator[bytes]:
    """Iterate a gzip-compressed reference NDJSON document."""
    compressor = zlib.compressobj(wbits=31)

    chunk = compressor.compress(
        dump_bytes({**reference, "type": "reference"}) + b"\n",
    )

    if chunk:
        yield chunk

    async for otu in otus:
        chunk = compressor.compress(dump_bytes({**otu, "type": "otu"}) + b"\n")

        if chunk:
            yield chunk

    yield compressor.flush()


def check_index_file_type(file_name: str) -> str:
    """Get the index file type based on the extension of given `file_name`

    :param file_name: index file name
    :return: file type

    """
    if file_name.endswith(".fa.gz"):
        return "fasta"

    if file_name.endswith(".json.gz"):
        return "json"

    if file_name.endswith(".ndjson.gz"):
        return "ndjson"

    return "bowtie2"


def compose_index_file_key(index_id: str, filename: str) -> str:
    return f"indexes/{index_id}/{filename}"


def compose_index_prefix(index_id: str) -> str:
    return f"indexes/{index_id}/"
