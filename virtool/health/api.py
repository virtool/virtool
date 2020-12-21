"""
Provides request handlers for Kubernetes health check.

"""
from virtool.api.response import json_response
import virtool.http.routes

routes = virtool.http.routes.Routes()


@routes.get("/api/health/alive")
async def is_alive(req):
    """
    Check if the server is alive.
    """
    return json_response({"alive": True})


@routes.get("/api/health/ready")
async def is_ready(req):
    """
    Check if the server is ready.
    """
    return json_response({"ready": True})

