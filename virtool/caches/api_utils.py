from collections.abc import AsyncIterator
from typing import Any

from aiohttp.web import Request

from virtool.api.custom_json import loads
from virtool.api.errors import APIBadRequest, APIRequestEntityTooLarge
from virtool.storage.errors import StorageKeyNotFoundError
from virtool.storage.protocol import STORAGE_CHUNK_SIZE

CACHE_MAX_SIZE = 10 * 1024**3
"""Maximum cache payload size in bytes."""


class CacheStorageMissingError(RuntimeError):
    """Raised when a cache row points at a missing storage object."""


async def cache_data_chunker(
    key: str, data: AsyncIterator[bytes]
) -> AsyncIterator[bytes]:
    try:
        async for chunk in data:
            yield chunk
    except StorageKeyNotFoundError as err:
        msg = f"Cache storage object is missing for key {key!r}"
        raise CacheStorageMissingError(msg) from err


def read_cache_params(req: Request) -> dict[str, Any] | None:
    value = req.query.get("params")

    if value is None:
        return None

    try:
        params = loads(value)
    except ValueError as err:
        raise APIBadRequest("Invalid JSON in 'params' query parameter") from err

    if params is None:
        return None

    if not isinstance(params, dict):
        raise APIBadRequest("Query parameter 'params' must be a JSON object")

    return params


def read_cache_content_length(req: Request) -> int:
    content_length = req.content_length

    if content_length is None:
        raise APIBadRequest("Content-Length header is required")

    if content_length > CACHE_MAX_SIZE:
        raise APIRequestEntityTooLarge(
            f"Cache payload exceeds maximum size of {CACHE_MAX_SIZE} bytes",
        )

    return content_length


async def cache_body_chunker(
    req: Request,
    content_length: int,
) -> AsyncIterator[bytes]:
    size = 0

    while chunk := await req.content.read(STORAGE_CHUNK_SIZE):
        size += len(chunk)

        if size > content_length:
            raise APIBadRequest("Request body size exceeds Content-Length")

        if size > CACHE_MAX_SIZE:
            raise APIRequestEntityTooLarge(
                f"Cache payload exceeds maximum size of {CACHE_MAX_SIZE} bytes",
            )

        yield chunk

    if size != content_length:
        raise APIBadRequest("Request body size does not match Content-Length")
