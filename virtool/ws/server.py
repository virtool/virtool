"""Classes for managing WebSocket connections."""

import asyncio
from asyncio import CancelledError
from typing import TYPE_CHECKING

from aiohttp.web_ws import WebSocketResponse
from structlog import get_logger

from virtool.api.client import UserClient
from virtool.api.custom_json import dump_string
from virtool.data.events import listen_for_client_events
from virtool.models.base import BaseModel
from virtool.redis import Redis
from virtool.users.sessions import SessionData
from virtool.ws.cls import WSDeleteMessage, WSInsertMessage, WSMessage

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer

logger = get_logger("ws")


class WSServer:
    """A server that sends WebSocket messages to connected clients."""

    def __init__(
        self,
        pg_connection_string: str,
        data: "DataLayer",
        redis: Redis,
    ) -> None:
        self._connections = []
        self._pg_connection_string = pg_connection_string
        self._data = data
        self._redis = redis

    async def run(self) -> None:
        """Start the Websocket server."""
        try:
            async for event in listen_for_client_events(self._pg_connection_string):
                if event.operation == "delete":
                    message = WSDeleteMessage(
                        interface=event.domain,
                        operation="delete",
                        data=[event.resource_id],
                    )
                else:
                    resource = await self._fetch_resource(
                        event.domain,
                        event.resource_id,
                    )

                    if resource is None:
                        continue

                    message = WSInsertMessage(
                        interface=event.domain,
                        operation="insert" if event.operation == "create" else "update",
                        data=resource,
                    )

                logger.info(
                    "sending websocket message",
                    domain=event.domain,
                    resource_id=event.resource_id,
                    operation=event.operation,
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

    async def _fetch_resource(
        self,
        domain: str,
        resource_id: str | int,
    ) -> BaseModel | None:
        """Fetch a resource from the data layer by domain and ID."""
        try:
            domain_obj = getattr(self._data, domain)
            return await domain_obj.get(resource_id)
        except AttributeError:
            logger.warning("unknown domain", domain=domain)
            return None
        except Exception:
            logger.exception(
                "failed to fetch resource",
                domain=domain,
                resource_id=resource_id,
            )
            return None

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
