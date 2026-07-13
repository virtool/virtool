import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

from virtool.storage.protocol import STORAGE_CHUNK_SIZE


async def iter_file_chunks(path: Path) -> AsyncIterator[bytes]:
    """Iterate chunks from ``path``."""
    with await asyncio.to_thread(path.open, "rb") as f:
        while chunk := await asyncio.to_thread(f.read, STORAGE_CHUNK_SIZE):
            yield chunk


def check_index_file_type(file_name: str) -> str:
    """Get the index file type based on the extension of given `file_name`

    :param file_name: index file name
    :return: file type

    """
    if file_name.endswith(".fa.gz"):
        return "fasta"

    if file_name.endswith(".json.gz"):
        return "json"

    return "bowtie2"


def compose_index_file_key(index_id: str, filename: str) -> str:
    return f"indexes/{index_id}/{filename}"


def compose_index_prefix(index_id: str) -> str:
    return f"indexes/{index_id}/"
