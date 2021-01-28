"""
Custom Types for Virtool

"""
from typing import Union, Dict, Sequence, Any

import aiohttp.web

App = Union[aiohttp.web.Application, Dict[str, Any]]
Projection = Union[Dict[str, bool], Sequence[str]]