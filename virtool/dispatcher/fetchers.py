"""
Fetchers provide a get() method
"""
from abc import ABC, abstractmethod
from asyncio import gather
from typing import AsyncIterable, List, Optional, Tuple

from sqlalchemy import inspect, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.indexes.db
import virtool.references.db
import virtool.samples.db
from virtool.db.core import Collection, DB
from virtool.dispatcher.change import Change
from virtool.dispatcher.connection import Connection
from virtool.dispatcher.operations import DELETE
from virtool.labels.db import attach_sample_count
from virtool.labels.models import Label
from virtool.samples.db import attach_labels
from virtool.tasks.models import Task
from virtool.types import Projection
from virtool.uploads.models import Upload
from virtool.utils import base_processor


def object_as_dict(obj):
    return {c.key: getattr(obj, c.key)
            for c in inspect(obj).mapper.column_attrs}


class AbstractFetcher(ABC):

    @abstractmethod
    async def prepare(
            self,
            change: Change,
            connections: List[Connection]
    ) -> AsyncIterable[Tuple[Connection, dict]]:
        """
        Fetch all records with IDs matching the passed ``id_list`` and are allowed to be viewed
        by the ``connection``
        """
        pass

    async def fetch(
            self,
            change: Change,
            connections: List[Connection]
    ):
        """
        Return connection-message pairs for the resources with IDs matching the passed ``id_list``
        as prepared by :meth:``prepare``.

        Returns deletion messages by default unless the attribute :attr:`auto_delete` is set to
        `False`.

        :param change: the change causing the dispatch
        :param connections: the authenticated connections from the dispatcher
        :return: connection-message pairs

        """
        if getattr(self, "auto_delete", True):
            if change.operation == DELETE:
                message = {
                    "interface": change.interface,
                    "operation": DELETE,
                    "data": change.id_list
                }

                for connection in connections:
                    yield connection, message

                return

        async for connection, message in self.prepare(change, connections):
            yield connection, message


class SimpleMongoFetcher(AbstractFetcher):

    def __init__(self, collection: Collection, projection: Optional[Projection] = None):
        self._collection = collection
        self._projection = projection

    async def prepare(self, change: Change, connections: List[Connection]):
        """
        Prepare and yield websocket message-connection pairs based on ``change``.

        This fetcher will allow the message to be distributed to all passed ``connections``. There
        is no right or permission checking.

        """
        cursor = self._collection.find(
            {"_id": {"$in": change.id_list}},
            projection=self._projection
        )

        async for document in cursor:
            message = {
                "interface": change.interface,
                "operation": change.operation,
                "data": base_processor(document)
            }

            for connection in connections:
                yield connection, message


class IndexesFetcher(AbstractFetcher):

    def __init__(self, db):
        self._db = db

    async def prepare(
            self,
            change: Change,
            connections: List[Connection]
    ):
        """
        Prepare index websocket message-connection pairs for dispatch.

        Calls indexes processor to add additional fields to the outgoing message.

        :param change: the change triggering the dispatch
        :param connections: the current authenticated connections in the dispatcher

        """
        documents = await self._db.indexes.find(
            {"_id": {"$in": change.id_list}},
            projection=virtool.indexes.db.PROJECTION
        ).to_list(None)

        documents = await gather(*[virtool.indexes.db.processor(self._db, d) for d in documents])

        for document in documents:
            for connection in connections:
                yield connection, {
                    "interface": change.interface,
                    "operation": change.operation,
                    "data": document
                }


class LabelsFetcher(AbstractFetcher):

    def __init__(self, pg: AsyncEngine, db: DB):
        self._pg = pg
        self._db = db

    async def prepare(self, change: Change, connections: List[Connection]):
        """
        Prepare label connection-message pairs to dispatch by WebSocket.

        Attach sample counts to the outgoing messages.

        :param change: the change that is triggering the dispatch
        :param connections: the connections to dispatch to

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(Label).filter(Label.id.in_(change.id_list)))

        records = [object_as_dict(record) for record in result.scalars().all()]

        await gather(*[attach_sample_count(self._db, record) for record in records])

        for record in records:
            for connection in connections:
                yield connection, {
                    "interface": change.interface,
                    "operation": change.operation,
                    "data": record
                }


class ReferencesFetcher(AbstractFetcher):

    def __init__(self, db: DB):
        self._db = db

    async def prepare(
            self,
            change: Change,
            connections: List[Connection]
    ):
        """
        Prepare reference connection-message pairs to dispatch by WebSocket.

        Run the data through the reference processor, thereby attaching related data from other
        collections. Only sends message on connections that have read rights on the associated
        reference.

        :param change: the change that is triggering the dispatch
        :param connections: the connections to dispatch to

        """
        documents = await self._db.references.find({
            "_id": {
                "$in": change.id_list
            }
        },
            projection=virtool.references.db.PROJECTION
        ).to_list(None)

        documents = await gather(
            *[virtool.references.db.processor(self._db, d) for d in documents]
        )

        for document in documents:
            user_ids = {user["id"] for user in document["users"]}
            group_ids = {group["id"] for group in document["groups"]}

            for connection in connections:
                if connection.user_id in user_ids or set(connection.groups).union(set(group_ids)):
                    yield connection, {
                        "interface": change.interface,
                        "operation": change.operation,
                        "data": document
                    }


class SamplesFetcher(AbstractFetcher):

    def __init__(self, pg: AsyncEngine, db: DB):
        self._pg = pg
        self._db = db

    async def prepare(self, change: Change, connections: List[Connection]):
        documents = await self._db.samples.find(
            {"_id": {"$in": change.id_list}},
            projection=virtool.samples.db.PROJECTION
        ).to_list(None)

        await gather(*[attach_labels(self._pg, d) for d in documents])

        for document in documents:
            user = document["user"]["id"]
            group = document["group"]

            for connection in connections:
                if connection.user_id == user or group in connection.groups:
                    yield connection, {
                        "interface": change.interface,
                        "operation": change.operation,
                        "data": base_processor(document)
                    }


class UploadsFetcher(AbstractFetcher):

    def __init__(self, pg: AsyncEngine):
        self._pg = pg
        self._interface = "uploads"

    async def prepare(self, change: Change, connections: List[Connection]):
        """
        Prepare reference connection-message pairs to dispatch by WebSocket.

        Run the data through the reference processor, thereby attaching related data from other
        collections. Only sends message on connections that have read rights on the associated
        reference.

        :param change: the change that is triggering the dispatch
        :param connections: the connections to dispatch to

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(Upload).filter(Upload.id.in_(change.id_list)))

        records = list(result.unique().scalars())

        for record in records:
            for connection in connections:
                if record.removed:
                    yield connection, {
                        "interface": change.interface,
                        "operation": DELETE,
                        "data": change.id_list
                    }
                else:
                    yield connection, {
                        "interface": change.interface,
                        "operation": change.operation,
                        "data": object_as_dict(record)
                    }


class TasksFetcher(AbstractFetcher):

    def __init__(self, pg: AsyncEngine):
        self._pg = pg
        self._interface = "tasks"

    async def prepare(self, change: Change, connections: List[Connection]):
        """
        Prepare task connection-message pairs to dispatch by WebSocket.

        :param change: the change that is triggering the dispatch
        :param connections: the connections to dispatch to

        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(select(Task).filter(Task.id.in_(change.id_list)))

        records = list(result.scalars())

        for record in records:
            for connection in connections:
                yield connection, {
                    "interface": change.interface,
                    "operation": change.operation,
                    "data": object_as_dict(record)
                }
