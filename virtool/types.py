"""Custom types aliases for Virtool."""

from collections.abc import Awaitable, Callable, Sequence
from datetime import datetime
from typing import (
    Any,
)

from aiohttp.web import Application, Request, Response

type App = Application | dict[str, Any]
"""
An aiohttp application or similar dictionary.

In testing ``dict``-like objects are sometimes used in place of an application.
"""

type Document = dict[
    str,
    dict | list | bool | str | int | float | datetime | None,
]
"""
A MongoDB document or similar dictionary.

Keys must be strings.
"""


type Projection = dict[str, bool] | Sequence[str]
"""
A data structure that can be used to specify a MongoDB projection and is compatible with
Motor interfaces.
"""

type RouteHandler = Callable[[Request], Awaitable[Response]]
"""
A handler method for an aiohttp route.

An asynchronous function that is called with a :class:`aiohttp.web.Request` and returns
a :class:`aiohttp.web.Response`.

"""
