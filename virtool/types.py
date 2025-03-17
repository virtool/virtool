"""Custom types aliases for Virtool."""

from collections.abc import AsyncIterable, Awaitable, Callable, Sequence
from datetime import datetime
from typing import (
    Any,
    Protocol,
    TypeAlias,
)

from aiohttp.web import Application, Request, Response

App: TypeAlias = Application | dict[str, Any]
"""
An aiohttp application or similar dictionary.

In testing ``dict``-like objects are sometimes used in place of an application.
"""

# async def multipart_file_chunker(
#     reader: MultipartReader,
# ) -> AsyncGenerator[bytearray, None]:
#     """Iterates through a ``MultipartReader`` as ``bytearray`` chunks."""
#     file = await reader.next()
#
#     while True:
#         chunk = await file.read_chunk(CHUNK_SIZE)
#
#         if not chunk:
#             break
#
#         yield chunk


class Chunker(Protocol):
    """A protocol for a function that chunks a file.

    The function should accept a :class:`aiohttp.MultipartReader` and return an`


    """

    async def __call__(self, req: Request) -> AsyncIterable[bytearray]:
        """Chunk a file from a multipart request."""


Document: TypeAlias = dict[
    str,
    dict | list | bool | str | int | float | datetime | None,
]
"""
A MongoDB document or similar dictionary.

Keys must be strings.
"""


Projection: TypeAlias = dict[str, bool] | Sequence[str]
"""
A data structure that can be used to specify a MongoDB projection and is compatible with
Motor interfaces.
"""

RouteHandler: TypeAlias = Callable[[Request], Awaitable[Response]]
"""
A handler method for an aiohttp route.

An asynchronous function that is called with a :class:`aiohttp.web.Request` and returns
a :class:`aiohttp.web.Response`.

"""
