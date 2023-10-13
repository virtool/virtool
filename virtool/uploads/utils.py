from asyncio import to_thread
from pathlib import Path
from typing import Any, Callable

import aiofiles
from aiohttp import MultipartReader
from cerberus import Validator
from structlog import get_logger

from virtool.config.cls import Config
from virtool.data.errors import ResourceNotFoundError

logger = get_logger("uploads")

CHUNK_SIZE = 1024 * 1000 * 50


def is_gzip_compressed(chunk: bytes):
    """
    Check if a file is gzip compressed.

    Peek at the first two bytes for the gzip magic number and raise and exception if it
    is not present.

    :param chunk: First byte chunk from a file being uploaded
    :raises OSError: An OSError is raised when the file is not gzip-compressed

    """
    if not chunk[:2] == b"\x1f\x8b":
        raise OSError("Not a gzipped file")


def naive_validator(req) -> Validator.errors:
    """
    Validate `name` given in an HTTP request using cerberus

    """
    v = Validator({"name": {"type": "string", "required": True}}, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return v.errors


async def multipart_file_chunker(reader: MultipartReader) -> bytearray:
    """Iterates through a ``MultipartReader`` as ``bytearray`` chunks."""
    file = await reader.next()

    while True:
        chunk = await file.read_chunk(CHUNK_SIZE)

        if not chunk:
            break

        yield chunk


async def naive_writer(
    chunker,
    path: Path,
    on_first_chunk: Callable[[bytes], Any] | None = None,
) -> int:
    """
    Write a new file from an HTTP multipart request.

    :param chunker: yields chunks of a file acquired from a multipart request
    :param path: the file path to write the data to
    :param on_first_chunk: a function to call with the first chunk of the file stream
    :return: size of the new file in bytes
    """
    size = 0

    await to_thread(path.parent.mkdir, parents=True, exist_ok=True)

    async with aiofiles.open(path, "wb") as f:
        async for chunk in chunker:
            if type(chunk) is str:
                logger.warning(
                    "Got string chunk while writing file", path=path, chunk=chunk
                )
                break

            if size == 0 and on_first_chunk:
                on_first_chunk(chunk)

            await f.write(chunk)

            size += len(chunk)

    logger.info("Wrote file", path=path, size=size)

    return size


async def get_upload_path(config: Config, name_on_disk: str) -> Path:
    """
    Get the local upload path and return it.
    """
    upload_path = config.data_path / "files" / name_on_disk

    if not await to_thread(upload_path.exists):
        raise ResourceNotFoundError("Uploaded file not found at expected location")

    return upload_path
