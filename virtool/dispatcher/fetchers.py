"""
Fetchers provide a get() method
"""
from abc import ABC, abstractmethod
from asyncio import gather
from typing import List, Optional, Sequence, Tuple, Union

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.indexes.db
import virtool.references.db
import virtool.samples.db
from virtool.samples.db import attach_labels
from virtool.types import Projection
from virtool.db.core import Collection, DB
from virtool.dispatcher.connection import Connection
from virtool.labels.db import attach_sample_count
from virtool.labels.models import Label
from virtool.utils import base_processor


class AbstractFetcher(ABC):

    @abstractmethod
    def fetch(self, connections: List[Connection], id_list: Sequence[Union[int, str]]):
        """
        Fetch all records with IDs matching the passed ``id_list`` and are allowed to be viewed
        by the ``connection``
        """
        pass


class SimpleMongoFetcher(AbstractFetcher):

    def __init__(self, collection: Collection, projection: Optional[Projection] = None):
        self._collection = collection
        self._projection = projection

    async def fetch(self, connections: List[Connection], id_list: Sequence[str]):
        """
        Fetch all documents with IDs matching the passed ``id_list`` and are allowed to be viewed
        by the ``connection``
        """
        documents = list()

        cursor = self._collection.find({"_id": {"$in": id_list}}, projection=self._projection)

        async for document in cursor:
            documents.append(base_processor(document))

        dispatches = list()
        for document in documents:
            user = document.get("user", {}).get("id")
            for connection in connections:
                if user is None or user == connection.user_id:
                    dispatches.append((connection, document))

        return dispatches


class IndexesFetcher(AbstractFetcher):

    def __init__(self, db: DB):
        self._db = db

    async def fetch(self, connections: List[Connection], id_list: Sequence[str]):
        documents = await self._db.indexes.find(
            {"_id": {"$in": id_list}},
            projection=virtool.indexes.db.PROJECTION
        ).to_list(None)

        await gather(*[virtool.indexes.db.processor(self._db, d) for d in documents])

        dispatches = list()

        for document in documents:
            user = document["user"]["id"]
            for connection in connections:
                if user == connection.user_id:
                    dispatches.append((connection, document))

        return dispatches


class LabelsFetcher(AbstractFetcher):

    def __init__(self, pg: AsyncEngine, db: DB):
        self._pg = pg
        self._db = db

    async def fetch(self, connections: List[Connection], id_list: Sequence[int]):
        async with AsyncSession(self._pg) as session:
            records = await session.execute(select(Label).filter(Label.id.in_(id_list)))

        await gather(*[attach_sample_count(self._db, record) for record in records])
        dispatches = list()

        for record in records:
            for connection in connections:
                dispatches.append((connection, record))

        return dispatches


class ReferencesFetcher(AbstractFetcher):

    def __init__(self, db: DB):
        self._db = db

    async def fetch(
            self,
            connections: List[Connection],
            id_list: Sequence[str]
    ) -> List[Tuple[Connection, dict]]:

        documents = await self._db.references.find({
            "_id": {
                "$in": id_list
            }
        },
            projection=virtool.references.db.PROJECTION
        ).to_list(None)

        documents = await gather(
            *[virtool.references.db.processor(self._db, d) for d in documents]
        )

        dispatches = list()

        for document in documents:
            users = {user["id"] for user in document["users"]}
            groups = {group["id"] for group in document["groups"]}

            for connection in connections:
                if connection.user_id in users or set(connection.groups).union(set(groups)):
                    dispatches.append((connection, document))

        return dispatches


class SamplesFetcher(AbstractFetcher):

    def __init__(self, pg: AsyncEngine, db: DB):
        self._pg = pg
        self._db = db

    async def fetch(self, connections: List[Connection], id_list: Sequence[str]):
        documents = await self._db.samples.find(
            {"_id": {"$in": id_list}},
            projection=virtool.samples.db.PROJECTION
        ).to_list(None)

        await gather(*[attach_labels(self._pg, d) for d in documents])

        dispatches = list()

        for document in documents:
            user = document["user"]["id"]
            group = document["group"]
            for connection in connections:
                if connection.user_id == user or group in connection.groups:
                    dispatches.append((connection, document))

        return dispatches
