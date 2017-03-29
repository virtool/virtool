import logging

from aiohttp import web, WSMsgType


logger = logging.getLogger(__name__)


async def websocket_handler(req):

    ws = web.WebSocketResponse()

    await ws.prepare(req)

    async for msg in ws:
        if msg.type == WSMsgType.TEXT:
            print(msg)

    return ws


class Dispatcher:

    def __init__(self):
        #: A list of all active connections.
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

    def dispatch(self, message, connections=None, conn_filter=None, conn_modifier=None, writer=None):
        """
        Dispatch a ``message`` with a conserved format to a selection of active ``connections``
        (:class:`.SocketHandler` objects). Messages are dicts with the scheme:

        +----------------+-----------------------------------------------------------------------+
        | Key            | Description                                                           |
        +================+=======================================================================+
        | operation      | a word used to tell the client what to do in response to the message. |
        +----------------+-----------------------------------------------------------------------+
        | interface      | the name of the interface the client should perform the operation on  |
        +----------------+-----------------------------------------------------------------------+
        | data           | test                                                                  |
        +----------------+-----------------------------------------------------------------------+

        :param message: the message to dispatch
        :type message: dict or list

        :param connections: the connection(s) (:class:`.SocketHandler` objects) to dispatch the message to.
        :type connections: list

        :param conn_filter: filters the connections to which messages are written.
        :type conn_filter: callable

        :param conn_modifier: modifies the connection objects to which messages are written.
        :type conn_modifier: callable

        :param writer: modifies the written message based on the connection.
        :type writer: callable

        """
        to_send = {
            "operation": None,
            "interface": None,
            "data": None
        }

        to_send.update(message)

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
                writer(connection, dict(to_send))

            return

        for connection in connections:
            connection.write_message(message)

    def ping(self):
        """
        Sends a ping message to the client to keep the connection alive. Added as a periodic callback using
        :meth:`.Application.add_periodic_callback` as soon as the dispatcher is created. Called every three seconds.

        """
        self.dispatch({
            "operation": "ping",
            "interface": None,
            "data": None
        })

        return "test"


def gen_log_prefix(connection):
    return "{} ({})".format(
        connection.user["_id"] or "<unauthorized>",
        connection.ip
    )
