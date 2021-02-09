import aiofiles
from cerberus import Validator

CHUNK_SIZE = 4096


def naive_validator(req):
    v = Validator({
        "name": {"type": "string", "required": True}
    }, allow_unknown=True)

    if not v.validate(dict(req.query)):
        return v.errors


async def naive_writer(req, file_path):
    reader = await req.multipart()
    file = await reader.next()

    size = 0

    async with aiofiles.open(file_path, "wb") as handle:
        while True:
            chunk = await file.read_chunk(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            await handle.write(chunk)

    return size
