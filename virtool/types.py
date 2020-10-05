"""
Custom Types for Virtool

"""
import typing

import aiohttp.web

App = typing.Union[aiohttp.web.Application, dict]