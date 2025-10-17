"""Provides handlers for managing Websocket related requests."""

from aiohttp.web import Request, Response, WebSocketResponse
from structlog import get_logger

from virtool.api.policy import WebSocketRoutePolicy, policy
from virtool.ws.server import WSConnection

logger = get_logger("ws")


@policy(WebSocketRoutePolicy)
async def root(req: Request) -> WebSocketResponse | Response:
    """Handle requests for WebSocket connections."""
    ws = WebSocketResponse(autoping=True, heartbeat=5)

    ready = ws.can_prepare(req)
    if not ready.ok:
        logger.info(
            "websocket connection not ready",
            reason="protocol_mismatch",
            user_id=req["client"].user_id if req.get("client") else None,
        )
        return Response(status=400, text="WebSocket connection not available")

    try:
        await ws.prepare(req)
    except AssertionError as e:
        if "transport" in str(e):
            logger.info(
                "websocket connection failed",
                reason="transport_unavailable",
                user_id=req["client"].user_id if req.get("client") else None,
            )
            return Response(status=503, text="Connection unavailable")
        raise

    connection = WSConnection(ws, req["client"])

    if not req["client"].authenticated:
        await connection.close(4000)
        return ws

    req.app["ws"].add_connection(connection)

    try:
        async for _ in ws:
            pass
    except RuntimeError as err:
        if "TCPTransport" not in str(err):
            raise

    req.app["ws"].remove_connection(connection)

    return ws
