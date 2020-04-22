import aiohttp.web

import virtool.api.json


@aiohttp.web.middleware
async def middleware(req, handler):
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
            resp.body = virtool.api.json.dumps(json_data)
        else:
            resp.body = virtool.api.json.pretty_dumps(json_data)

    return resp
