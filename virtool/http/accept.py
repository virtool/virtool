from typing import Callable

import aiohttp.web

from virtool.api.custom_json import dumps, pretty_dumps


@aiohttp.web.middleware
async def middleware(req: aiohttp.web.Request, handler: Callable):
    """
    Formats JSON if 'application/json' content type was not in request 'Accept' header.

    """
    accepts_json = False

    for accept in req.headers.getall("ACCEPT", []):
        if "application/json" in accept.lower():
            accepts_json = True
            break

    resp = await handler(req)

    if "json_data" in resp:
        json_data = resp.pop("json_data")

        resp.headers["Content-Type"] = "application/json; charset=utf=8"

        if accepts_json:
            resp.body = dumps(json_data)
        else:
            resp.body = pretty_dumps(json_data)

    return resp
