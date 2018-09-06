import logging
from copy import deepcopy

import virtool.api.utils
INTERFACES = (
    "analyses",
    "files",
    "groups",
    "history",
    "hmm",
    "indexes",
    "jobs",
    "processes",
    "references",
    "samples",
    "settings",
    "software",
    "status",
    "subtractions",
    "users"
)

OPERATIONS = (
    "insert",
    "update",
    "delete"
)


async def default_writer(connection, message):
    return await connection.send(message)


class Connection:

    def __init__(self, ws, session):
        self._ws = ws
        self.ping = self._ws.ping
        self.user_id = session.user_id
        self.groups = session.groups
        self.permissions = session.permissions

    async def send(self, message):
        await self._ws.send_json(message, dumps=virtool.api.utils.dumps)

    async def close(self):
        await self._ws.close()


class Dispatcher:

    def __init__(self, loop):
        self.loop = loop

        #: A dict of all active connections.
        self.connections = list()

        logging.debug("Initialized dispatcher")

    def add_connection(self, connection):
        """
        Add a connection to the dispatcher.

        """
        self.connections.append(connection)
        logging.debug("Added connection to dispatcher: {}".format(connection.user_id))

    def remove_connection(self, connection):
        """
        Remove a connection from the dispatcher. Make sure it is closed first.

        :param connection: the connection to remove
        :type connection: :class:`.SocketHandler`

        """
        try:
            self.connections.remove(connection)
            logging.debug("Removed connection from dispatcher: {}".format(connection.user_id))
        except ValueError:
            pass

    async def dispatch(self, interface, operation, data, connections=None, conn_filter=None, conn_modifier=None,
                       writer=default_writer):
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
        if not interface in INTERFACES:
            raise ValueError(f'Unknown dispatch interface: {interface}')

        if not operation in OPERATIONS:
            raise ValueError(f'Unknown dispatch operation: {operation}')

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

        if writer and not callable(writer):
            raise TypeError("writer must be callable")

        connections_to_remove = list()

        for connection in connections:
            try:
                await writer(connection, deepcopy(message))
            except RuntimeError as err:
                if "RuntimeError: unable to perform operation on <TCPTransport" in str(err):
                    connections_to_remove.append(connection)

        for connection in connections_to_remove:
            self.remove_connection(connection)

        logging.debug("Dispatched {}.{}".format(interface, operation))

    async def close(self):
        logging.debug("Closing dispatcher")

        for connection in self.connections:
            await connection.close()

        logging.debug("Closed dispatcher")
