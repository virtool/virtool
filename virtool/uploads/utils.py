import os
import pathlib
from typing import Optional, Tuple, Union

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
    return chunk[:2] == b"\x1f\x8b"


def naive_validator(req) -> Validator.errors:
    """
    Validate `name` given in a HTTP request using cerberus

    """
    v = Validator({"name": {"type": "string", "required": True}}, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return v.errors


async def naive_writer(req: aiohttp.web.Request, path: pathlib.Path, compressed: bool = False) -> Optional[Union[int, Tuple[int, str]]]:
    """
    Write a new file from a HTTP multipart request.

    :param req: aiohttp request object
    :param file_path: Either a path to a folder, or a complete path that includes a filename.
    :param compressed: Whether or not to enforce gzip compression, defaults to False
    :return: size of the new file in bytes
    """
    reader = await req.multipart()
    file = await reader.next()
    path_is_file = True

    size = 0

    if not path.suffix:
        path = path / file.filename
        path_is_file = False

    try:
        await req.app["run_in_thread"](os.makedirs, path.parent)
    except FileExistsError:
        pass

    async with aiofiles.open(path, "wb") as handle:
        while True:
            chunk = await file.read_chunk(CHUNK_SIZE)
            if not chunk:
                break

            if size == 0 and compressed:
                if not is_gzip_compressed(chunk):
                    return None, None

            size += len(chunk)
            await handle.write(chunk)

    if not path_is_file:
        return size, path.name
    
    return size
