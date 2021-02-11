import asyncio
import logging
from typing import Union

import virtool.analyses.db
import virtool.api
import virtool.api.json
import virtool.groups.db
import virtool.history.db
import virtool.hmm.db
import virtool.indexes.db
import virtool.jobs.db
import virtool.otus.db
import virtool.tasks.db
import virtool.references.db
import virtool.samples.db
import virtool.software.db
import virtool.subtractions.db
import virtool.users.db
import virtool.utils

#: Allowed interfaces. Calls to :meth:`.Dispatcher.dispatch` will be validated against these interfaces.
INTERFACES = (
    "analyses",
    "caches",
    "files",
    "groups",
    "history",
    "hmm",
    "indexes",
    "jobs",
    "labels",
    "otus",
    "tasks",
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

logger = logging.getLogger(__name__)


class Connection:

    def __init__(self, ws, session):
        self._ws = ws
        self.ping = self._ws.ping
        self.user_id = session.user_id
        self.groups = session.groups
        self.permissions = session.permissions

    async def send(self, message):
        await self._ws.send_json(message, dumps=virtool.api.json.dumps)

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


class Dispatcher:

    def __init__(self, db, q):
        #: A dict of all active connections.
        self.db = db
        self.connections = list()
        self.q = q

    async def run(self):
        logger.debug("Started dispatcher")
        try:
            while True:
                interface, operation, id_list = await self.q.get()
                await self.dispatch(interface, operation, id_list)
                self.q.task_done()
        except asyncio.CancelledError:
            await self.q.join()

            for conn in self.connections:
                await conn.close()


    def add_connection(self, connection: Connection):
        """
        Add a connection to the dispatcher.

        :param connection: the connection to add

        """
        self.connections.append(connection)
        logging.debug(f'Added connection to dispatcher: {connection.user_id}')

    def update_connections(self, user: dict):
        """
        Given a user document, updates the `groups` and `permissions` attributes for all active
        :class:`.Connection` objects.

        :param user: a user document

        """
        user_id = user["id"]

        for connection in self.connections:
            if connection.user_id == user_id:
                connection.groups = user["groups"]
                connection.permissions = user["permissions"]

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

    async def dispatch(self, interface: str, operation: str, id_list: Union[tuple, list]):
        """
        Dispatch a ``message`` with a conserved format to a selection of active ``connections``.

        :param interface: the name of the interface the client should perform the operation on
        :param operation: a word used to tell the client what to do in response to the message
        :param id_list: the data the client will use
        """
        if interface not in INTERFACES:
            raise ValueError(f'Unknown dispatch interface: {interface}')

        if operation not in OPERATIONS:
            raise ValueError(f'Unknown dispatch operation: {operation}')

        # If the connections parameter was not set, dispatch the message to all authorized connections. Authorized
        # connections have assigned ``user_id`` properties.
        connections = [conn for conn in self.connections if conn.user_id]

        connections_to_remove = list()

        messages = await self.prepare_messages(
            interface,
            operation,
            id_list
        )

        for connection in connections:
            try:
                for message in messages:
                    await connection.send(message)
            except RuntimeError as err:
                if "RuntimeError: unable to perform operation on <TCPTransport" in str(err):
                    connections_to_remove.append(connection)

        for connection in connections_to_remove:
            self.remove_connection(connection)

        logging.debug(f"Dispatched {interface}.{operation}")

    async def close(self):
        logging.debug("Closing dispatcher")

        for connection in self.connections:
            await connection.close()

        logging.debug("Closed dispatcher")

    async def prepare_messages(self, interface, operation, id_list):
        if operation == "delete":
            return [{
                "interface": interface,
                "operation": operation,
                "data": id_list
            }]

        collection = getattr(self.db, interface)

        projection = self.db.get_projection(interface)
        apply_processor = self.db.get_processor(interface)

        messages = list()

        async for document in collection.find({"_id": {"$in": id_list}}, projection=projection):
            messages.append({
                "interface": interface,
                "operation": operation,
                "data": await apply_processor(document)
            })

        return messages
