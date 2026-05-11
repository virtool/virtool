from collections.abc import AsyncIterator

from aiohttp.web import Request, StreamResponse

from virtool.api.errors import APINotFound
from virtool.storage.errors import StorageKeyNotFoundError


async def stream_storage_response(
    req: Request,
    stream: AsyncIterator[bytes],
    headers: dict[str, str],
    not_found_message: str = "",
) -> StreamResponse:
    response = StreamResponse(headers=headers)

    try:
        first_chunk = await anext(stream)
    except StorageKeyNotFoundError:
        raise APINotFound(not_found_message or None)
    except StopAsyncIteration:
        first_chunk = None

    await response.prepare(req)

    if first_chunk is not None:
        await response.write(first_chunk)

        async for chunk in stream:
            await response.write(chunk)

    return response
