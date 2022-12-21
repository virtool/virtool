"""
Custom Types for Virtool

"""
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Sequence, Union, Optional

from aiohttp.web import Application, Request, Response

App = Union[Application, Dict[str, Any]]
Document = Dict[str, Optional[Union[Dict, List, bool, str, int, float, datetime]]]
Projection = Union[Dict[str, bool], Sequence[str]]
RouteHandler = Callable[[Request], Awaitable[Response]]
