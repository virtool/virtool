from aiohttp import web

import virtool.app_dispatcher


async def root(req):
    """
    Handles requests for WebSocket connections.

    """
    ws = web.WebSocketResponse(autoping=True, heartbeat=10)

    connection = virtool.app_dispatcher.Connection(ws, req["session"])

    req.app["dispatcher"].add_connection(connection)

    await ws.prepare(req)

    async for msg in ws:
        pass

    req.app["dispatcher"].remove_connection(connection)

    return ws
