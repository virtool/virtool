from aiohttp.web import middleware


@middleware
async def headers_middleware(req, handler):
    """
    Middleware that adds the current version of the API to the response.

    """
    resp = await handler(req)
    resp.headers["X-Virtool-Version"] = req.app["version"]
    resp.headers["Server"] = "Virtool"

    return resp
