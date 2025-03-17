from aiohttp.typedefs import Handler
from aiohttp.web import Request, middleware
from aiohttp.web_response import StreamResponse
from structlog import get_logger

from virtool.config import get_config_from_req

logger = get_logger("http")


@middleware
async def logging_middleware(request: Request, handler: Handler) -> StreamResponse:
    """Middleware for logging requests."""
    resp = await handler(request)

    authenticated = False
    user_id = None

    if client := request.get("client"):
        authenticated = client.authenticated
        user_id = client.user_id

    real_ip_header = get_config_from_req(request).real_ip_header

    logger.info(
        "handled request",
        authenticated=authenticated,
        ip=request.headers.get(real_ip_header) if real_ip_header else request.remote,
        method=request.method,
        path=request.path,
        status=resp.status,
        user_id=user_id,
    )

    return resp
