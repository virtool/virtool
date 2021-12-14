from aiohttp.web import middleware
from aiohttp.web_request import Request
from aiohttp.web_response import Response


@middleware
async def headers_middleware(req, handler):
    """
    Middleware that adds the current version of the API to the response.

    """
    resp = await handler(req)
    resp.headers["X-Virtool-Version"] = req.app["version"]
    resp.headers["Server"] = "Virtool"

    return resp


async def on_prepare_location(req: Request, resp: Response):
    """
    Signal handler that adds base URL to Location header or Content-Location if possible
    """
    location = resp.headers.get("Location")
    base_url = req.app["config"].base_url

    if location and base_url not in location:
        resp.headers["Location"] = base_url + location

    content_location = resp.headers.get("Content-Location")

    if content_location and base_url not in content_location:
        resp.headers["Content-Location"] = base_url + content_location
