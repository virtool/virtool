import aiofiles
from cerberus import Validator

CHUNK_SIZE = 4096


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
        file_path.parent.mkdir()
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
