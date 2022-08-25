import logging

from aiohttp import web

import virtool.dispatcher.dispatcher
from virtool.http.policy import policy, WebSocketRoutePolicy

logger = logging.getLogger(__name__)


@policy(WebSocketRoutePolicy)
async def root(req: web.Request) -> web.WebSocketResponse:
    """
    Handles requests for WebSocket connections.

    """
    ws = web.WebSocketResponse(autoping=True, heartbeat=5)

    await ws.prepare(req)

    connection = virtool.dispatcher.dispatcher.Connection(ws, req["client"])

    if not req["client"].authenticated:
        await connection.close(4000)
        return ws

    req.app["dispatcher"].add_connection(connection)

    try:
        async for _ in ws:
            pass
    except RuntimeError as err:
        if "TCPTransport" not in str(err):
            raise

    logger.info("Connection closed")

    req.app["dispatcher"].remove_connection(connection)

    return ws
