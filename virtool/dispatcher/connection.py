from typing import Union

from aiohttp.web_ws import WebSocketResponse

import virtool.api.json


class Connection:
    """
    Wraps a :class:``WebSocketResponse``.
    """

    def __init__(self, ws: WebSocketResponse, session):
        self._ws = ws
        self.ping = self._ws.ping
        self.user_id = session.user_id
        self.groups = session.groups
        self.permissions = session.permissions

    async def send(self, message: Union[dict, list]):
        """
        Sends the passed JSON-encodable message to the connected client.
        :param message: the message to send
        """
        await self._ws.send_json(message, dumps=virtool.api.json.dumps)

    async def close(self):
        """
        Closes the underlying websocket connection.
        """
        await self._ws.close()
