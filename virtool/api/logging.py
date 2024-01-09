from aiohttp.web import Request, middleware
from structlog import get_logger

logger = get_logger("http")


@middleware
async def logging_middleware(req: Request, handler):
    resp = await handler(req)

    logger.info("handled request", method=req.method, path=req.path, status=resp.status)

    return resp
