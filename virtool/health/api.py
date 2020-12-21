"""
Provides request handlers for Kubernetes health check.

"""
from aiohttp import web
import virtool.http.routes

routes = virtool.http.routes.Routes()


@routes.get("/api/health/alive")
async def is_alive(req):
    """
    Check if the server is alive.
    """
    return web.Response(text="alive", status=200)


@routes.get("/api/health/ready")
async def is_ready(req):
    """
    Check if the server is ready.
    """
    return web.Response(text="ready", status=200)
