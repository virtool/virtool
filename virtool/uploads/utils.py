import os
import pathlib
from logging import getLogger
from typing import Callable, Optional, Any

import aiofiles
from aiohttp.web_request import Request
from cerberus import Validator

logger = getLogger(__name__)

CHUNK_SIZE = 4096
WRITE_BUFFER_LENGTH = 10000


def is_gzip_compressed(chunk: bytes):
    """
    Check if a file is gzip compressed by checking the first two bytes for the gzip magic number.

    :param chunk: First byte chunk from a file being uploaded
    :raises OSError: An OSError is raised when the file is not gzip-compressed

    """
    if not chunk[:2] == b"\x1f\x8b":
        raise OSError("Not a gzipped file")


def naive_validator(req) -> Validator.errors:
    """
    Validate `name` given in a HTTP request using cerberus

    """
    v = Validator({"name": {"type": "string", "required": True}}, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return v.errors


async def naive_writer(
        req: Request,
        path: pathlib.Path,
        on_first_chunk: Optional[Callable[[bytes], Any]] = None
) -> Optional[int]:
    """
    Write a new file from a HTTP multipart request.

    :param req: aiohttp request object
    :param path: A complete path (including filename) to where the file should be written
    :param on_first_chunk: A function to call with the first chunk of the file stream
    :return: size of the new file in bytes
    """
    reader = await req.multipart()
    file = await reader.next()

    size = 0

    try:
        await req.app["run_in_thread"](os.makedirs, path.parent)
    except FileExistsError:
        pass

    buffer = list()

    async with aiofiles.open(path, "wb") as handle:
        while True:
            chunk = await file.read_chunk(CHUNK_SIZE)

            if not chunk:
                break

            if size == 0 and on_first_chunk:
                on_first_chunk(chunk)

            buffer.append(chunk)

            size += len(chunk)

            if len(buffer) > WRITE_BUFFER_LENGTH:
                continue

            await handle.write(b"".join(buffer))
            buffer = list()

    return size
