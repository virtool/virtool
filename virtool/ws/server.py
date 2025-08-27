"""Classes for managing WebSocket connections."""

import asyncio
from asyncio import CancelledError

from aiohttp.web_ws import WebSocketResponse
from structlog import get_logger

from virtool.api.client import UserClient
from virtool.api.custom_json import dump_string
from virtool.data.events import Operation, listen_for_events
from virtool.redis import Redis
from virtool.users.sessions import SessionData
from virtool.ws.cls import WSDeleteMessage, WSInsertMessage, WSMessage

logger = get_logger("ws")


class WSServer:
    """A server that send WebSocket messages to connected clients."""

    def __init__(self, redis: Redis) -> None:
        """Initialize the websocket server with a Redis client.

        :param redis: a redis client.
        """
        self._connections = []
        self._redis = redis

    async def run(self) -> None:
        """Start the Websocket server."""
        try:
            async for event in listen_for_events(self._redis):
                if event.operation == Operation.CREATE:
                    message = WSInsertMessage(
                        interface=event.domain,
                        operation="insert",
                        data=event.data,
                    )

                elif event.operation == Operation.UPDATE:
                    message = WSDeleteMessage(
                        interface=event.domain,
                        operation="update",
                        data=event.data,
                    )

                else:
                    message = WSDeleteMessage(
                        interface=event.domain,
                        operation="delete",
                        data=[event.data.id],
                    )

                logger.info(
                    "Sending WebSocket message",
                    domain=event.domain,
                    operation=event.operation,
                    id=event.data.id,
                )

                await asyncio.gather(
                    *[
                        connection.send(message)
                        for connection in self.authenticated_connections
                    ],
                )

        except CancelledError:
            pass

        await self.close()

    def add_connection(self, connection: "WSConnection") -> None:
        """Add a connection to the websocket server.

        :param connection: the connection to add

        """
        self._connections.append(connection)
        logger.info("established websocket connection", user_id=connection.user_id)

    def remove_connection(self, connection: "WSConnection") -> None:
        """Close and remove a connection.

        :param connection: the connection to remove
        """
        try:
            self._connections.remove(connection)
            logger.info("closed websocket connection", user_id=connection.user_id)
        except ValueError:
            pass

    async def periodically_close_expired_websocket_connections(self) -> None:
        """Periodically check for and close connections with expired sessions."""
        session_data = SessionData(self._redis)

        while True:
            logger.info("closing expired websocket connections")

            for connection in self._connections:
                if not await session_data.check_session_is_authenticated(
                    connection.session_id,
                ):
                    await connection.close(1001)

            await asyncio.sleep(300)

    @property
    def authenticated_connections(self) -> list["WSConnection"]:
        """A list of all authenticated connections."""
        return [conn for conn in self._connections if conn.user_id]

    async def close(self) -> None:
        """Close the server and all connections."""
        logger.info("closing websocket server")

        for connection in self._connections:
            await connection.close(1001)

        logger.info("closed websocket server")


class WSConnection:
    """Wraps a :class:``WebSocketResponse``."""

    def __init__(self, ws: WebSocketResponse, user_client: UserClient) -> None:
        """Initialize a WSConnection.

        The connection used the passed WebSocketResponse for communication and is
        associated with the passed user client.

        :param ws: the WebSocketResponse to wrap.
        :param user_client: the user client to use.
        """
        self._ws = ws
        self.ping = self._ws.ping
        self.user_id = user_client.user_id
        self.groups = user_client.groups
        self.permissions = user_client.permissions
        self.session_id = user_client.session_id

    async def send(self, message: WSMessage) -> None:
        """Send the passed JSON-encodable message to the connected client.

        :param message: the message to send
        """
        try:
            await self._ws.send_json(message, dumps=dump_string)
        except ConnectionResetError as err:
            if "Cannot write to closing transport" not in str(err):
                raise

            await self.close(1002)

    async def close(self, code: int) -> None:
        """Close the underlying websocket connection.

        :param code: closure code to send to the client
        """
        await self._ws.close(code=code)
