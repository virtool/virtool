from copy import deepcopy

import virtool.handlers.utils


class Connection:

    def __init__(self, ws, session):
        self._ws = ws
        self.user_id = session.user_id
        self.groups = session.groups
        self.permissions = session.permissions

    async def send(self, message):
        await self._ws.send_json(message, dumps=virtool.handlers.utils.dumps)

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
        try:
            self.connections.remove(connection)
        except ValueError:
            pass

    async def dispatch(self, interface, operation, data, connections=None, conn_filter=None, conn_modifier=None,
                       writer=None):
        """
        Dispatch a ``message`` with a conserved format to a selection of active ``connections``.

        :param interface: the name of the interface the client should perform the operation on
        :type interface: str

        :param operation: a word used to tell the client what to do in response to the message
        :type operation: str

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

        # If the connections parameter was not set, dispatch the message to all authorized connections. Authorized
        # connections have assigned ``user_id`` properties.
        connections = connections or [conn for conn in self.connections if conn.user_id]

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
                await writer(connection, deepcopy(message))

            return

        for connection in connections:
            await connection.send(message)

    async def close(self):
        for connection in self.connections:
            await connection.close()
