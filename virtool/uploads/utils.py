import os
import pathlib
from typing import Optional, Dict

import aiofiles
import aiohttp.web
from cerberus import Validator

import virtool.utils

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
    v = Validator({
        "name": {"type": "string", "required": True}
    }, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return v.errors


async def naive_writer(req, file_path) -> int:
    """
    Write a new file from a HTTP multipart request.

    :return: size of the new file in bytes
    """
    reader = await req.multipart()
    file = await reader.next()

    size = 0

    try:
        await req.app["run_in_thread"](os.makedirs, file_path.parent)
    except FileExistsError:
        pass

    async with aiofiles.open(file_path, "wb") as handle:
        while True:
            chunk = await file.read_chunk(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            await handle.write(chunk)

    return size


async def naive_write_multiple(req: aiohttp.web.Request, file_path: pathlib.Path) -> Optional[Dict[str, int]]:
    """
    Write multiple files from a HTTP multipart request. Files must be `gzip` compressed.

    :param req: aiohttp request object
    :param file_path: Path to a folder where the new files should be written to
    :return: A dictionary containing each new file's name on disk mapped to the file's size
    """
    reader = await req.multipart()
    file = await reader.next()
    files = dict()

    try:
        await req.app["run_in_thread"](os.makedirs, file_path)
    except FileExistsError:
        pass

    while file:
        size = 0
        filename = file.filename
        new_file = dict()

        async with aiofiles.open(file_path / filename, "wb") as handle:
            while True:
                chunk = await file.read_chunk(CHUNK_SIZE)
                if not chunk:
                    break

                if size == 0 and not is_gzip_compressed(chunk):
                    return None

                size += len(chunk)
                await handle.write(chunk)

            new_file["size"], new_file["uploaded_at"] = size, virtool.utils.timestamp()

            files[filename] = new_file
            file = await reader.next()

    return files
