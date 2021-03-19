import os
import pathlib
from typing import Callable, Optional

import aiofiles
import aiohttp.web
from cerberus import Validator

CHUNK_SIZE = 4096


def is_gzip_compressed(chunk: bytes) -> bool:
    """
    Check if a file is gzip compressed by checking the first two bytes for the gzip magic number.

    :param chunk: First byte chunk from a file being uploaded
    :return: A boolean indicating whether the file is gzip compressed or not
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
        req: aiohttp.web.Request, path: pathlib.Path, on_first_chunk: Optional[Callable] = None) -> Optional[int]:
    """
    Write a new file from a HTTP multipart request.

    :param req: aiohttp request object
    :param path: A complete path (including filename) to where the file should be written
    :param compressed: An optional callable to check for gzip compression
    :return: size of the new file in bytes
    """
    reader = await req.multipart()
    file = await reader.next()

    size = 0

    try:
        await req.app["run_in_thread"](os.makedirs, path.parent)
    except FileExistsError:
        pass

    async with aiofiles.open(path, "wb") as handle:
        while True:
            chunk = await file.read_chunk(CHUNK_SIZE)
            if not chunk:
                break

            if size == 0 and on_first_chunk:
                on_first_chunk(chunk)

            size += len(chunk)
            await handle.write(chunk)

    return size
