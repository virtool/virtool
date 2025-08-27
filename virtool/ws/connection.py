from aiohttp.web_ws import WebSocketResponse

from virtool.api.client import UserClient
from virtool.api.custom_json import dump_string
from virtool.ws.cls import WSMessage


class WSConnection:
    """Wraps a :class:``WebSocketResponse``."""

    def __init__(self, ws: WebSocketResponse, user_client: UserClient) -> None:
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
