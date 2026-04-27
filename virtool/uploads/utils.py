from collections.abc import AsyncGenerator

from aiohttp import MultipartReader
from cerberus import Validator

CHUNK_SIZE = 1024 * 1000 * 50


def is_gzip_compressed(chunk: bytes) -> None:
    """Check if a file is gzip compressed.

    Peek at the first two bytes for the gzip magic number and raise and exception if it
    is not present.

    :param chunk: First byte chunk from a file being uploaded
    :raises OSError: An OSError is raised when the file is not gzip-compressed

    """
    if not chunk[:2] == b"\x1f\x8b":
        raise OSError("Not a gzipped file")


def naive_validator(req) -> Validator.errors:
    """Validate `name` given in an HTTP request using cerberus"""
    v = Validator({"name": {"type": "string", "required": True}}, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return v.errors


async def multipart_file_chunker(
    reader: MultipartReader,
) -> AsyncGenerator[bytearray]:
    """Iterates through a ``MultipartReader`` as ``bytearray`` chunks."""
    file = await reader.next()

    while True:
        chunk = await file.read_chunk(CHUNK_SIZE)

        if not chunk:
            break

        yield chunk


def upload_file_key(name_on_disk: str) -> str:
    """Derive the storage key for an uploaded file."""
    return f"files/{name_on_disk}"
