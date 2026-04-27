from collections.abc import AsyncIterator

from aiohttp.web import Request, StreamResponse

from virtool.api.errors import APINotFound
from virtool.storage.errors import StorageKeyNotFoundError


async def stream_storage_response(
    req: Request,
    stream: AsyncIterator[bytes],
    size: int,
    headers: dict[str, str],
    not_found_message: str = "",
) -> StreamResponse:
    response = StreamResponse(headers=headers)

    if size > 0:
        try:
            first_chunk = await anext(stream)
        except (StopAsyncIteration, StorageKeyNotFoundError):
            raise APINotFound(not_found_message or None)

        await response.prepare(req)
        await response.write(first_chunk)

        async for chunk in stream:
            await response.write(chunk)
    else:
        await response.prepare(req)

    return response
