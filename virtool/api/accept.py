from collections.abc import Callable

from aiohttp.web import Request, middleware
from aiohttp.web_response import StreamResponse

from virtool.api.custom_json import dump_bytes, dump_pretty_bytes


@middleware
async def accept_middleware(req: Request, handler: Callable) -> StreamResponse:
    """Formats JSON if 'application/json' content type was not in request 'Accept'
    header.
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
            resp.body = dump_bytes(json_data)
        else:
            resp.body = dump_pretty_bytes(json_data)

    return resp
