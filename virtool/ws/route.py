"""
Provides handlers for managing Websocket related requests.
"""

from aiohttp.web import Request, WebSocketResponse

from virtool.http.policy import policy, WebSocketRoutePolicy
from virtool.ws.connection import WSConnection


@policy(WebSocketRoutePolicy)
async def root(req: Request) -> WebSocketResponse:
    """
    Handles requests for WebSocket connections.

    """
    ws = WebSocketResponse(autoping=True, heartbeat=5)

    await ws.prepare(req)

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
