import asyncio
from asyncio import CancelledError

from structlog import get_logger

from virtool.data.events import Operation, listen_for_events
from virtool.redis import Redis
from virtool.users.sessions import SessionData
from virtool.ws.cls import WSDeleteMessage, WSInsertMessage
from virtool.ws.connection import WSConnection

logger = get_logger("ws")


class WSServer:
    def __init__(self, redis: Redis) -> None:
        #: All active client connections.
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

    def add_connection(self, connection: WSConnection) -> None:
        """Add a connection to the websocket server.

        :param connection: the connection to add

        """
        self._connections.append(connection)
        logger.info("established websocket connection", user_id=connection.user_id)

    def remove_connection(self, connection: WSConnection) -> None:
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
    def authenticated_connections(self) -> list[WSConnection]:
        """A list of all authenticated connections."""
        return [conn for conn in self._connections if conn.user_id]

    async def close(self) -> None:
        """Close the server and all connections."""
        logger.info("closing websocket server")

        for connection in self._connections:
            await connection.close(1001)

        logger.info("closed websocket server")
