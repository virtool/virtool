from aiohttp import web


async def websocket_handler(req):
    """
    Handles requests for WebSocket connections.
     
    """
    # if req["session"].authorized:
    ws = web.WebSocketResponse(autoping=True, heartbeat=10)

    connection = Connection(ws, req["session"])

    req.app["dispatcher"].add_connection(connection)

    await ws.prepare(req)

    async for msg in ws:
        pass

    await connection.close()

    return ws

    # return web.json_response({"message": "Not authorized"}, status=403)


class Connection:

    def __init__(self, ws, session):
        self._ws = ws
        self.user_id = session.user_id
        self.groups = session.groups

    async def send(self, message):
        await self._ws.send_json(message)

    async def close(self):
        await self._ws.close()


class Dispatcher:

    def __init__(self):
        #: A dict of all active connections.
        self.connections = list()

    def add_connection(self, connection):
        """
        Add a connection to the dispatcher.

        """
        self.connections.append(connection)

    def remove_connection(self, connection):
        """
        Remove a connection from the dispatcher. Make sure it is closed first.

        :param connection: the connection to remove
        :type connection: :class:`.SocketHandler`

        """
        self.connections.remove(connection)

    def dispatch(self, operation, interface, data, connections=None, conn_filter=None, conn_modifier=None, writer=None):
        """
        Dispatch a ``message`` with a conserved format to a selection of active ``connections``.

        :param operation: a word used to tell the client what to do in response to the message
        :type operation: str
        
        :param interface: the name of the interface the client should perform the operation on
        :type interface: str
        
        :param data: the data the client will use
        :type data: dict

        :param connections: the connection(s) (:class:`.SocketHandler` objects) to dispatch the message to.
        :type connections: list

        :param conn_filter: filters the connections to which messages are written.
        :type conn_filter: callable

        :param conn_modifier: modifies the connection objects to which messages are written.
        :type conn_modifier: callable

        :param writer: modifies the written message based on the connection.
        :type writer: callable

        """
        message = {
            "operation": operation,
            "interface": interface,
            "data": data
        }

        # If the connections parameter was not set, dispatch the message to all authorized connections.
        connections = connections or [conn for conn in self.connections if conn.authorized]

        if conn_filter:
            if not callable(conn_filter):
                raise TypeError("conn_filter must be callable")

            connections = [conn for conn in connections if conn_filter(conn)]

        if conn_modifier:
            if not callable(conn_modifier):
                raise TypeError("conn_modifier must be callable")

            for connection in connections:
                conn_modifier(connection)

        if writer:
            if not callable(writer):
                raise TypeError("writer must be callable")

            for connection in connections:
                writer(connection, dict(message))

            return

        for connection in connections:
            connection.write_message(message)
