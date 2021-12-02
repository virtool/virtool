from typing import Callable

from aiohttp import web
from aiohttp.web_exceptions import HTTPNotFound
from virtool.api.response import (InvalidInput, InvalidQuery, NotFound,
                                  json_response)


@web.middleware
async def middleware(req: web.Request, handler: Callable):
    try:
        resp = await handler(req)
        return resp
    except web.HTTPException as exc:
        data = {
            "id": "_".join(exc.reason.lower().split(" ")),
            "message": exc.text
        }

        if isinstance(exc, (InvalidQuery, InvalidInput)):
            data["errors"] = exc.errors

        return json_response(data, exc.status)
