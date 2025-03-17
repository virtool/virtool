from aiohttp.typedefs import Handler
from aiohttp.web import middleware
from aiohttp.web_request import Request
from aiohttp.web_response import StreamResponse

from virtool.config import get_config_from_req


@middleware
async def headers_middleware(request: Request, handler: Handler) -> StreamResponse:
    """Middleware that adds the current version of the API to the response."""
    resp = await handler(request)
    resp.headers["X-Virtool-Version"] = request.app["version"]
    resp.headers["Server"] = "Virtool"

    return resp


async def on_prepare_location(request: Request, response: StreamResponse) -> None:
    """Signal handler that adds base URL to Location and Content-Location headers."""
    location = response.headers.get("Location")
    base_url = get_config_from_req(request).base_url

    if location and base_url not in location:
        response.headers["Location"] = base_url + location

    content_location = response.headers.get("Content-Location")

    if content_location and base_url not in content_location:
        response.headers["Content-Location"] = base_url + content_location
