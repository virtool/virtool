"""Provides handlers for managing Websocket related requests."""

from aiohttp.web import WebSocketResponse

from virtool.api.policy import WebSocketRoutePolicy, policy
from virtool.api.routes import Routes
from virtool.api.status import R204
from virtool.api.view import APIView
from virtool.ws.connection import WSConnection

routes = Routes()


@routes.web.view("/")
class WebsocketView(APIView):
    """Handles requests for WebSocket connections."""

    @policy(WebSocketRoutePolicy)
    async def get(self) -> R204:
        """Establish Websocket connection.

        Handles requests for WebSocket connections.
        """
        ws = WebSocketResponse(autoping=True, heartbeat=5)

        await ws.prepare(self.request)

        connection = WSConnection(ws, self.request["client"])

        if not self.request["client"].authenticated:
            await connection.close(4000)
            return ws

        self.app["ws"].add_connection(connection)

        try:
            async for _ in ws:
                pass
        except RuntimeError as err:
            if "TCPTransport" not in str(err):
                raise

        self.app["ws"].remove_connection(connection)

        return ws
