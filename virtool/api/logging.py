from aiohttp.web import Request, middleware
from structlog import get_logger

from virtool.config import get_config_from_req

logger = get_logger("http")


@middleware
async def logging_middleware(req: Request, handler):
    """Middleware for logging requests."""
    resp = await handler(req)

    authenticated = False
    user_id = None

    if client := req.get("client"):
        authenticated = client.authenticated
        user_id = client.user_id

    real_ip_header = get_config_from_req(req).real_ip_header

    logger.info(
        "handled request",
        authenticated=authenticated,
        ip=req.headers.get(real_ip_header) if real_ip_header else req.remote,
        method=req.method,
        path=req.path,
        status=resp.status,
        user_id=user_id,
    )

    return resp
