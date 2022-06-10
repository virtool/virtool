"""
The dispatcher
"""
from asyncio import CancelledError
from dataclasses import dataclass
from logging import getLogger
from typing import List

from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.analyses.db
import virtool.caches.db
import virtool.history.db
import virtool.hmm.db
import virtool.jobs.db
import virtool.otus.db
import virtool.subtractions.db
import virtool.users.db
from virtool.dispatcher.change import Change
from virtool.dispatcher.connection import Connection
from virtool.dispatcher.fetchers import (
    IndexesFetcher,
    LabelsFetcher,
    ReferencesFetcher,
    SamplesFetcher,
    SimpleMongoFetcher,
    TasksFetcher,
    UploadsFetcher,
)
from virtool.dispatcher.listener import RedisDispatcherListener
from virtool.dispatcher.operations import DELETE, INSERT, UPDATE
from virtool.mongo.core import DB

logger = getLogger(__name__)


@dataclass
class Fetchers:
    analyses: SimpleMongoFetcher
    caches: SimpleMongoFetcher
    groups: SimpleMongoFetcher
    history: SimpleMongoFetcher
    hmm: SimpleMongoFetcher
    indexes: IndexesFetcher
    jobs: SimpleMongoFetcher
    labels: LabelsFetcher
    otus: SimpleMongoFetcher
    tasks: TasksFetcher
    references: ReferencesFetcher
    samples: SamplesFetcher
    sequences: SimpleMongoFetcher
    settings: SimpleMongoFetcher
    status: SimpleMongoFetcher
    subtraction: SimpleMongoFetcher
    uploads: UploadsFetcher
    users: SimpleMongoFetcher


class Dispatcher:
    def __init__(self, pg: AsyncEngine, db: DB, listener: RedisDispatcherListener):
        #: A dict of all active connections.
        self.db = db
        self._listener = listener
        self._fetchers = Fetchers(
            analyses=SimpleMongoFetcher(
                db.analyses,
                virtool.analyses.db.PROJECTION,
                virtool.analyses.db.processor,
            ),
            caches=SimpleMongoFetcher(db.caches, virtool.caches.db.PROJECTION),
            groups=SimpleMongoFetcher(db.groups),
            history=SimpleMongoFetcher(
                db.history,
                virtool.history.db.LIST_PROJECTION,
                processor=virtool.history.db.processor,
            ),
            hmm=SimpleMongoFetcher(db.hmm, virtool.hmm.db.PROJECTION),
            indexes=IndexesFetcher(db),
            jobs=SimpleMongoFetcher(
                db.jobs, virtool.jobs.db.PROJECTION, virtool.jobs.db.processor
            ),
            labels=LabelsFetcher(pg, db),
            otus=SimpleMongoFetcher(db.otus, virtool.otus.db.PROJECTION),
            tasks=TasksFetcher(pg),
            references=ReferencesFetcher(db),
            samples=SamplesFetcher(pg, db),
            sequences=SimpleMongoFetcher(db.sequences),
            settings=SimpleMongoFetcher(db.settings),
            status=SimpleMongoFetcher(db.status),
            subtraction=SimpleMongoFetcher(
                db.subtraction, virtool.subtractions.db.PROJECTION
            ),
            uploads=UploadsFetcher(db, pg),
            users=SimpleMongoFetcher(db.users, virtool.users.db.PROJECTION),
        )

        #: All active client connections.
        self._connections = list()

    async def run(self):
        """
        Start the dispatcher.

        The dispatcher loops through available changes in the ``listener`` and
        dispatches them as messages to connected websocket clients.

        """
        logger.debug("Started dispatcher")

        try:
            async for change in self._listener:
                await self._dispatch(change)
                logger.debug(f"Received change: {change.target}")
        except CancelledError:
            pass

        logger.debug("Stopped listening for changes")

        await self.close()

    def add_connection(self, connection: Connection):
        """
        Add a connection to the dispatcher.

        :param connection: the connection to add

        """
        self._connections.append(connection)
        logger.debug(f"Added connection to dispatcher: {connection.user_id}")

    def remove_connection(self, connection: Connection):
        """
        Remove a connection from the dispatcher. Make sure it is closed first.

        :param connection: the connection to remove

        """
        try:
            self._connections.remove(connection)
            logger.debug(f"Removed connection from dispatcher: {connection.user_id}")
        except ValueError:
            pass

    @property
    def authenticated_connections(self) -> List[Connection]:
        """
        A list of the authenticated connections tracked by the dispatcher.

        """
        return [conn for conn in self._connections if conn.user_id]

    async def _dispatch(self, change: Change):
        """
        Dispatch a ``message`` with a conserved format to authenticated connections.

        :param change: the change to dispatch

        """
        try:
            fetcher = getattr(self._fetchers, change.interface)
        except AttributeError:
            logger.warning(f"Unknown dispatch interface: {change.interface}")
            return

        if change.operation not in (DELETE, INSERT, UPDATE):
            raise ValueError(f"Unknown dispatch operation: {change.operation}")

        async for connection, message in fetcher.fetch(
            change, self.authenticated_connections
        ):
            try:
                await connection.send(message)
            except RuntimeError as err:
                if "RuntimeError: unable to perform operation on <TCPTransport" in str(
                    err
                ):
                    self.remove_connection(connection)

        logger.debug(f"Dispatcher sent messages for {change.target}")

    async def close(self):
        """
        Stop the dispatcher and close all connections.

        """
        logger.debug("Closing dispatcher")

        for connection in self._connections:
            await connection.close()

        logger.debug("Closed dispatcher")
