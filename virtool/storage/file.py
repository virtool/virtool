from collections.abc import AsyncIterator
from pathlib import Path

import aiofiles

from virtool.storage.protocol import STORAGE_CHUNK_SIZE


async def read_file_chunks(path: Path) -> AsyncIterator[bytes]:
    """Read a file as fixed-size chunks of bytes."""
    async with aiofiles.open(path, "rb") as handle:
        while chunk := await handle.read(STORAGE_CHUNK_SIZE):
            yield chunk
