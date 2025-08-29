from typing import Any

import arrow
from aiohttp.web import json_response
from orjson import orjson
from pydantic import BaseModel


def custom_dumps(obj: Any) -> str:
    b = orjson.dumps(
        obj,
        option=orjson.OPT_INDENT_2
        | orjson.OPT_SORT_KEYS
        | orjson.OPT_NAIVE_UTC
        | orjson.OPT_UTC_Z,
    )

    return b.decode(encoding="UTF-8")


def default_serializer(obj):
    """Converts Pydantic BaseModel objects into Python dictionaries for serialization."""
    if issubclass(type(obj), BaseModel):
        return obj.dict(by_alias=True)

    raise TypeError


def generate_not_found():
    return json_response({"id": "not_found", "message": "Not found"}, status=404)


async def read_file_from_request(request, name, fmt) -> dict:
    reader = await request.multipart()
    file = await reader.next()

    size = 0
    chunk_size = 1024 * 1024

    while True:
        chunk = await file.read_chunk(chunk_size)

        if not chunk:
            break

        size += len(chunk)

    return {
        "id": 1,
        "description": None,
        "name": name,
        "format": fmt,
        "name_on_disk": f"1-{name}",
        "size": size,
        "uploaded_at": arrow.utcnow().naive,
    }
