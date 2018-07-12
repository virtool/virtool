import logging

from aiohttp import web

import virtool.dispatcher

logger = logging.getLogger(__name__)


async def root(req):
    """
    Handles requests for WebSocket connections.

    """
    ws = web.WebSocketResponse()

    await ws.prepare(req)

    connection = virtool.dispatcher.Connection(ws, req["client"])

    req.app["dispatcher"].add_connection(connection)

    async for _ in ws:
        pass

    logger.info("Connection closed")

    req.app["dispatcher"].remove_connection(connection)

    return ws
