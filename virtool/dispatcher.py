import logging
from copy import deepcopy
from typing import Union

import virtool.api.utils
import virtool.db.analyses
import virtool.db.files
import virtool.db.groups
import virtool.db.history
import virtool.db.hmm
import virtool.db.indexes
import virtool.db.jobs
import virtool.db.otus
import virtool.db.processes
import virtool.db.references
import virtool.db.samples
import virtool.db.software
import virtool.db.status
import virtool.db.subtractions
import virtool.db.users
import virtool.utils

#: Allowed interfaces. Calls to :meth:`.Dispatcher.dispatch` will be validated against these interfaces.
INTERFACES = (
    "analyses",
    "files",
    "groups",
    "history",
    "hmm",
    "indexes",
    "jobs",
    "otus",
    "processes",
    "references",
    "samples",
    "sequences",
    "settings",
    "software",
    "status",
    "subtraction",
    "users"
)

#: Allowed operations. Calls to :meth:`.Dispatcher.dispatch` will be validated against these operations.
OPERATIONS = (
    "insert",
    "update",
    "delete"
)


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


async def default_writer(connection: Connection, message: dict):
    """
    The default writer for sending dispatch messages.

    Writers are used to modify messages based on the sending :class:`.Connection`. The default writer does not modify
    the message.

    :param connection: the connection to send the message through
    :param message: the message
    """
    return await connection.send(message)


def get_processor(interface: str):
    """
    Returns a Virtool-style document processor given an `interface` name (eg. samples). The only `interface` that uses a
    custom processor is "jobs".

    The function :func:`virtool.utils.base_processor` will be returned for all other interfaces.

    :param interface: the name of the interface
    :return: a projection suitable for Pymongo or `None`

    :param interface:
    :return:
    """
    if interface == "jobs":
        return virtool.db.jobs.processor

    return virtool.utils.base_processor


def get_projection(interface: str) -> Union[dict, list]:
    """
    Returns a Pymongo projection given an `interface` name (eg. samples). If the interface name is unknown or no
    projection exists for that interface, `None` is returned.

    :param interface: the name of the interface
    :return: a projection suitable for Pymongo or `None`

    """
    return {
        "analyses": virtool.db.analyses.PROJECTION,
        "files": virtool.db.files.PROJECTION,
        "history": virtool.db.history.PROJECTION,
        "hmm": virtool.db.hmm.PROJECTION,
        "indexes": virtool.db.indexes.PROJECTION,
        "jobs": virtool.db.jobs.PROJECTION,
        "otus": virtool.db.otus.PROJECTION,
        "references": virtool.db.references.PROJECTION,
        "samples": virtool.db.samples.PROJECTION,
        "subtractions": virtool.db.subtractions.PROJECTION,
        "users": virtool.db.users.PROJECTION
    }.get(interface, None)


class Dispatcher:

    def __init__(self):
        #: A dict of all active connections.
        self.connections = list()
        logging.debug("Initialized dispatcher")

    def add_connection(self, connection: Connection):
        """
        Add a connection to the dispatcher.

        :param connection: the connection to add

        """
        self.connections.append(connection)
        logging.debug(f'Added connection to dispatcher: {connection.user_id}')

    def remove_connection(self, connection: Connection):
        """
        Remove a connection from the dispatcher. Make sure it is closed first.

        :param connection: the connection to remove

        """
        try:
            self.connections.remove(connection)
            logging.debug(f'Removed connection from dispatcher: {connection.user_id}')
        except ValueError:
            pass

    async def dispatch(
            self,
            interface: str,
            operation: str,
            data: Union[dict, list],
            connections=None,
            conn_filter=None,
            conn_modifier=None,
            writer=default_writer
    ):
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
        if interface not in INTERFACES:
            raise ValueError(f'Unknown dispatch interface: {interface}')

        if operation not in OPERATIONS:
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
