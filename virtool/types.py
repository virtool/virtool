"""
Custom Types for Virtool

"""
from typing import Union, Dict, Sequence, Any, Callable, Awaitable

import aiohttp.web

App = Union[aiohttp.web.Application, Dict[str, Any]]
Projection = Union[Dict[str, bool], Sequence[str]]
RouteHandler = Callable[[aiohttp.web.Request], Awaitable[aiohttp.web.Response]]
