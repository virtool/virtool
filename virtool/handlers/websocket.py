import asyncio
import logging
from aiohttp import web

import virtool.app_dispatcher

logger = logging.getLogger(__name__)


async def root(req):
    """
    Handles requests for WebSocket connections.

    """
    ws = web.WebSocketResponse()

    connection = virtool.app_dispatcher.Connection(ws, req["client"])

    req.app["dispatcher"].add_connection(connection)

    await ws.prepare(req)

    i = 0

    while not ws.closed:
        try:
            if i == 50:
                print("pinging")
                ws.ping()
                i = 0
            else:
                i += 1
        except RuntimeError as err:
            if "unable to perform operation on <TCPTransport closed=True" in str(err):
                break

        await asyncio.sleep(0.1, loop=req.app.loop)

    logger.info("Connection closed")

    req.app["dispatcher"].remove_connection(connection)

    return ws
