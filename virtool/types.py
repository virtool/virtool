"""Custom types aliases for Virtool."""
from __future__ import annotations

from datetime import datetime
from typing import (
    Any,
    Awaitable,
    Callable,
    Sequence,
    TypeAlias,
)

from aiohttp.web import Application, Request, Response

App: TypeAlias = Application | dict[str, Any]
"""
An aiohttp application or similar dictionary.

In testing ``dict``-like objects are sometimes used in place of an application.
"""

Document: TypeAlias = dict[
    str, dict | list | bool | str | int | float | datetime | None
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
