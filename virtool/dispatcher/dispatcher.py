"""
The dispatcher
"""
from asyncio import CancelledError
from dataclasses import dataclass
from logging import getLogger
from typing import List, Tuple

from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.analyses.db
import virtool.caches.db
import virtool.files.db
import virtool.history.db
import virtool.hmm.db
import virtool.indexes.db
import virtool.jobs.db
import virtool.otus.db
import virtool.references.db
import virtool.samples.db
import virtool.subtractions.db
import virtool.tasks.db
import virtool.users.db
from virtool.db.core import DB
from virtool.dispatcher.connection import Connection
from virtool.dispatcher.fetchers import LabelsFetcher, SimpleMongoFetcher
from virtool.dispatcher.fetchers import AbstractFetcher, IndexesFetcher, ReferencesFetcher, SamplesFetcher
from virtool.dispatcher.listener import AbstractDispatcherListener
from virtool.dispatcher.message import Message
from virtool.dispatcher.operations import DELETE, INSERT, UPDATE

logger = getLogger(__name__)


@dataclass
class Fetchers:
    analyses: SimpleMongoFetcher
    caches: SimpleMongoFetcher
    files: SimpleMongoFetcher
    groups: SimpleMongoFetcher
    history: SimpleMongoFetcher
    hmm: SimpleMongoFetcher
    indexes: IndexesFetcher
    jobs: SimpleMongoFetcher
    labels: LabelsFetcher
    otus: SimpleMongoFetcher
    tasks: SimpleMongoFetcher
    references: ReferencesFetcher
    samples: SamplesFetcher
    sequences: SimpleMongoFetcher
    settings: SimpleMongoFetcher
    software: SimpleMongoFetcher
    status: SimpleMongoFetcher
    subtraction: SimpleMongoFetcher
    users: SimpleMongoFetcher


class Dispatcher:

    def __init__(self, pg: AsyncEngine, db: DB, listener: RedisDispatcherListener):
        #: A dict of all active connections.
        self.db = db
        self._listener = listener
        self._fetchers = Fetchers(
            SimpleMongoFetcher(db.analyses, virtool.analyses.db.PROJECTION),
            SimpleMongoFetcher(db.caches, virtool.caches.db.PROJECTION),
            SimpleMongoFetcher(db.files, virtool.files.db.PROJECTION),
            SimpleMongoFetcher(db.groups),
            SimpleMongoFetcher(db.history, virtool.history.db.LIST_PROJECTION),
            SimpleMongoFetcher(db.hmm, virtool.hmm.db.PROJECTION),
            IndexesFetcher(db),
            SimpleMongoFetcher(db.jobs, virtool.jobs.db.PROJECTION),
            LabelsFetcher(pg, db),
            SimpleMongoFetcher(db.otus, virtool.otus.db.PROJECTION),
            SimpleMongoFetcher(db.tasks),
            ReferencesFetcher(db),
            SamplesFetcher(pg, db),
            SimpleMongoFetcher(db.sequences),
            SimpleMongoFetcher(db.settings),
            SimpleMongoFetcher(db.settings),
            SimpleMongoFetcher(db.status),
            SimpleMongoFetcher(db.subtraction, virtool.subtractions.db.PROJECTION),
            SimpleMongoFetcher(db.users, virtool.users.db.PROJECTION)
        )

        #: All active client connections.
        self._connections = list()

    async def run(self):
        logger.debug("Started dispatcher")

        try:
            async for message in self._listener.get():
                await self._dispatch(message)
                logger.debug(f"Received change: {message}")
        except CancelledError:
            pass

        logger.debug("Stopped listening for changes")

        for conn in self._connections:
            await conn.close()

        logger.debug("Stopped dispatcher")

    def add_connection(self, connection: Connection):
        """
        Add a connection to the dispatcher.
        :param connection: the connection to add
        """
        self._connections.append(connection)
        logger.debug(f'Added connection to dispatcher: {connection.user_id}')

    def remove_connection(self, connection: Connection):
        """
        Remove a connection from the dispatcher. Make sure it is closed first.
        :param connection: the connection to remove
        """
        try:
            self._connections.remove(connection)
            logger.debug(f'Removed connection from dispatcher: {connection.user_id}')
        except ValueError:
            pass

    @property
    async def authenticated_connections(self) -> List[Connection]:
        return [conn for conn in self._connections if conn.user_id]

    async def _dispatch(self, message: Message):
        """
        Dispatch a ``message`` with a conserved format to all active connections.
        :param message: the message to dispatch
        """
        try:
            fetcher = getattr(self._fetchers, message.interface)
        except AttributeError:
            raise ValueError(f'Unknown dispatch interface: {message.interface}')

        if message.operation not in (DELETE, INSERT, UPDATE):
            raise ValueError(f'Unknown dispatch operation: {message.operation}')

        for connection, dispatch in await self._prepare(fetcher, message):
            try:
                await connection.send(dispatch)
            except RuntimeError as err:
                if "RuntimeError: unable to perform operation on <TCPTransport" in str(err):
                    self.remove_connection(connection)

        logger.debug(f"Dispatched {message}")

    async def _prepare(
            self,
            fetcher: AbstractFetcher,
            message: Message
    ) -> List[Tuple[Connection, dict]]:
        """
        Prepare messages to be sent by the dispatcher.
        Fetches the records in the appropriate shape for a dispatch given the ``id_list``. If
        the dispatch described the removal of a record, a list of removed IDs is sent instead of
        the actual records.
        :param message: the message to prepare dispatches for
        """
        if message.operation == DELETE:
            return [(connection, {
                "interface": message.interface,
                "operation": DELETE,
                "data": message.id_list
            }) for connection in self._connections]

        to_dispatch = await fetcher.fetch(self._connections, message.id_list)

        return [(connection, {
            "interface": message.interface,
            "operation": message.operation,
            "data": data
        }) for connection, data in to_dispatch]

    async def close(self):
        """
        Stop the dispatcher and close all connections.
        """
        logger.debug("Closing dispatcher")

        for connection in self._connections:
            await connection.close()

        logger.debug("Closed dispatcher")