import asyncio
from asyncio import CancelledError

from aioredis import Redis
from structlog import get_logger

from virtool.data.events import EventListener, Operation
from virtool.users.sessions import SessionData
from virtool.ws.cls import WSInsertMessage, WSDeleteMessage
from virtool.ws.connection import WSConnection

logger = get_logger("ws")


class WSServer:
    def __init__(self, redis: Redis):
        #: All active client connections.
        self._connections = []
        self._redis = redis

    async def run(self):
        """Start the Websocket server."""
        try:
            async for event in EventListener(self._redis):
                if event.operation == Operation.CREATE:
                    message = WSInsertMessage(
                        interface=event.domain, operation="insert", data=event.data
                    )

                elif event.operation == Operation.UPDATE:
                    message = WSDeleteMessage(
                        interface=event.domain, operation="update", data=event.data
                    )

                else:
                    message = WSDeleteMessage(
                        interface=event.domain, operation="delete", data=[event.data.id]
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
                    ]
                )

        except CancelledError:
            pass

        await self.close()

    def add_connection(self, connection: WSConnection):
        """
        Add a connection to the websocket server.

        :param connection: the connection to add

        """
        self._connections.append(connection)
        logger.info("Established Websocket connection", user_id=connection.user_id)

    def remove_connection(self, connection: WSConnection):
        """
        Close and remove a connection.

        :param connection: the connection to remove

        """
        try:
            self._connections.remove(connection)
            logger.info("Closed WebSocket connection", user_id=connection.user_id)
        except ValueError:
            pass

    async def periodically_close_expired_websocket_connections(self):
        """
        Periodically check for and close connections with expired sessions.
        """
        session_data = SessionData(self._redis)

        while True:
            logger.info("Closing expired websocket connections")

            for connection in self._connections:
                if not await session_data.check_session_is_authenticated(
                    connection.session_id
                ):
                    await connection.close(1001)

            await asyncio.sleep(300)

    @property
    def authenticated_connections(self) -> list[WSConnection]:
        """
        A list of all authenticated connections.

        """
        return [conn for conn in self._connections if conn.user_id]

    async def close(self):
        """
        Close the server and all connections.

        """
        logger.info("Closing WebSocket server")

        for connection in self._connections:
            await connection.close(1001)

        logger.info("Closed WebSocket server")
