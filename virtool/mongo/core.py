"""
Core database classes.

The purpose of these classes is to automatically dispatch database changes via
:class:`Dispatcher` using the projections and processors appropriate for each
collection.

"""
from contextlib import asynccontextmanager
from typing import Any, Awaitable, Callable, Dict, List, Optional, Sequence, Union

from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorClientSession,
    AsyncIOMotorCollection,
)
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from pymongo.results import DeleteResult, UpdateResult

import virtool.analyses.db
import virtool.caches.db
import virtool.mongo.utils
import virtool.history.db
import virtool.hmm.db
import virtool.indexes.db
import virtool.jobs.db
import virtool.mongo.connect
import virtool.otus.db
import virtool.references.db
import virtool.samples.db
import virtool.settings.db
import virtool.subtractions.db
import virtool.uploads.db
import virtool.users.db
import virtool.utils
from virtool.dispatcher.operations import DELETE, INSERT, UPDATE
from virtool.types import Document, Projection


class Collection:
    """
    A wrapper for a Motor collection.

    Wraps collection methods that modify the database and automatically dispatches
    websocket messages to inform clients of the changes.

    """

    def __init__(
        self,
        name: str,
        collection: AsyncIOMotorCollection,
        enqueue_change: Callable[[str, str, Sequence[str]], None],
        processor: Callable[[Any, Document], Awaitable[Document]],
        projection: Optional[Projection],
        silent: bool = False,
    ):
        self.name = name
        self._collection = collection
        self.database = collection.database
        self._enqueue_change = enqueue_change
        self.processor = processor
        self.projection = projection
        self.silent = silent

        # No dispatches are necessary for these collection methods, so they can be
        # directly referenced instead of wrapped.
        self.aggregate = self._collection.aggregate
        self.bulk_write = self._collection.bulk_write
        self.count_documents = self._collection.count_documents
        self.create_index = self._collection.create_index
        self.create_indexes = virtool.mongo.connect.create_indexes
        self.distinct = self._collection.distinct
        self.drop_index = self._collection.drop_index
        self.drop_indexes = self._collection.drop_indexes
        self.find_one = self._collection.find_one
        self.find = self._collection.find
        self.insert_many = self._collection.insert_many
        self.rename = self._collection.rename

    async def apply_processor(self, document):
        if self.processor:
            return await self.processor(self._collection.database, document)

        return virtool.utils.base_processor(document)

    def enqueue_change(self, operation: str, *id_list: str):
        """
        Dispatch collection updates.

        Applies the collection projection and processor.

        Does not dispatch if the collection is `silent` or `silent` parameter is
        `True`.

        :param operation: the dispatch operation (insert, update, delete)
        :param id_list: the document IDs the queue changes for

        """
        if not self.silent:
            self._enqueue_change(self.name, operation, id_list)

    async def delete_many(
        self,
        query: dict,
        silent: bool = False,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> DeleteResult:
        """
        Delete many documents based on the passed `query`.

        :param query: a MongoDB query
        :param silent: don't dispatch websocket messages for this operation
        :param session: an optional Motor session to use
        :return: the result

        """
        id_list = await self.distinct("_id", query)

        delete_result = await self._collection.delete_many(query, session=session)

        if not silent and len(id_list):
            self.enqueue_change(DELETE, *id_list)

        return delete_result

    async def delete_one(
        self,
        query: dict,
        silent: bool = False,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> DeleteResult:
        """
        Delete a single document based on the passed `query`.

        :param query: a MongoDB query
        :param silent: don't dispatch websocket messages for this operation
        :param session: an optional Motor session to use
        :return: the result

        """
        document_id = await virtool.mongo.utils.get_one_field(
            self._collection, "_id", query
        )

        delete_result = await self._collection.delete_one(query, session=session)

        if not silent and delete_result.deleted_count:
            self.enqueue_change(DELETE, document_id)

        return delete_result

    async def find_one_and_update(
        self,
        query: dict,
        update: dict,
        projection: Optional[Projection] = None,
        silent: bool = False,
        upsert: bool = False,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> Optional[Document]:
        """
        Update a document and return the updated result.

        :param query: a MongoDB query used to select the documents to update
        :param update: a MongoDB update
        :param projection: a projection to apply to the document instead of the default
        :param silent: don't dispatch websocket messages for this operation
        :param upsert: insert a new document if no existing document is found
        :param session: an optional Motor session to use
        :return: the updated document

        """
        document = await self._collection.find_one_and_update(
            query,
            update,
            return_document=ReturnDocument.AFTER,
            upsert=upsert,
            session=session,
        )

        if document is None:
            return None

        if not silent:
            self.enqueue_change(UPDATE, document["_id"])

        if projection:
            return virtool.mongo.utils.apply_projection(document, projection)

        return document

    async def insert_one(
        self,
        document: Document,
        silent: bool = False,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> Document:
        """
        Insert the `document`.

        If no `_id` is included in the `document`, one will be autogenerated. If a
        provided `_id` already exists, a :class:`DuplicateKeyError` will be raised.

        :param document: the document to insert
        :param silent: don't dispatch the change to connected clients
        :param session: an optional Motor session to use
        :return: the inserted document

        """
        generate_id = "_id" not in document

        if generate_id:
            document["_id"] = virtool.utils.random_alphanumeric(8)

        try:
            await self._collection.insert_one(document, session=session)

            if not silent:
                self.enqueue_change(INSERT, document["_id"])

            return document
        except DuplicateKeyError:
            if generate_id:
                document.pop("_id")
                return await self._collection.insert_one(document, session=session)

            raise

    async def replace_one(
        self,
        query: Dict[str, Any],
        replacement: Document,
        upsert: bool = False,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> Document:
        """
        Replace the document identified using `query` with the `replacement` document.

        :param query: the query used to find a document to replace
        :param replacement: the replacement document
        :param upsert: insert a new document if nothing matches the query
        :param session: an optional Motor session to use
        :return: the replacement document

        """
        document = await self._collection.find_one_and_replace(
            query,
            replacement,
            projection=self.projection,
            upsert=upsert,
            session=session,
        )

        self.enqueue_change(UPDATE, replacement["_id"])

        return document

    async def update_many(
        self,
        query: Union[str, Dict],
        update: Dict,
        silent: bool = False,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> UpdateResult:
        """
        Update all documents that match `query` by applying the `update`.

        :param query: the query to match
        :param update: the update to apply to matching documents
        :param silent: don't dispatch the change to connected clients
        :param session: an optional Motor session to use
        :return: the Pymongo `UpdateResult` object

        """
        updated_ids = await self._collection.distinct("_id", query, session=session)
        update_result = await self._collection.update_many(
            query, update, session=session
        )

        if not silent:
            self.enqueue_change(UPDATE, *updated_ids)

        return update_result

    async def update_one(
        self,
        query: Union[str, Dict],
        update: Dict,
        upsert: bool = False,
        silent: bool = False,
        session: Optional[AsyncIOMotorClientSession] = None,
    ) -> UpdateResult:
        """
        Update one document matching the `query` by applying the `update`.

        :param query: the query to match
        :param update: the update to apply to matching document
        :param upsert: insert a new document if there is no match for the query
        :param silent: don't dispatch the change to connected clients
        :param session: an optional Motor session to use
        :return: the Pymongo `UpdateResult` object

        """
        document = await self.find_one(query, ["_id"], session=session)
        update_result = await self._collection.update_one(
            query, update, upsert=upsert, session=session
        )

        if not silent and document:
            self.enqueue_change(UPDATE, document["_id"])

        return update_result


class DB:
    def __init__(
        self,
        motor_client: AsyncIOMotorClient,
        enqueue_change: Callable[[str, str, List[str]], None],
    ):
        self.motor_client = motor_client
        self.start_session = motor_client.start_session
        self.enqueue_change = enqueue_change

        self.analyses = self.bind_collection(
            "analyses", projection=virtool.analyses.db.PROJECTION
        )

        self.caches = self.bind_collection(
            "caches", projection=virtool.caches.db.PROJECTION
        )

        self.files = self.bind_collection(
            "files", projection=virtool.uploads.db.PROJECTION
        )

        self.groups = self.bind_collection("groups")

        self.history = self.bind_collection(
            "history", projection=virtool.history.db.PROJECTION
        )

        self.hmm = self.bind_collection("hmm", projection=virtool.hmm.db.PROJECTION)

        self.indexes = self.bind_collection(
            "indexes", projection=virtool.indexes.db.PROJECTION
        )

        self.jobs = self.bind_collection(
            "jobs",
            projection=virtool.jobs.db.LIST_PROJECTION,
            processor=virtool.jobs.db.processor,
        )

        self.keys = self.bind_collection("keys", silent=True)

        self.labels = self.bind_collection("labels")

        self.otus = self.bind_collection("otus", projection=virtool.otus.db.PROJECTION)

        self.tasks = self.bind_collection("tasks")

        self.references = self.bind_collection(
            "references",
            processor=virtool.references.db.processor,
            projection=virtool.references.db.PROJECTION,
        )

        self.samples = self.bind_collection(
            "samples", projection=virtool.samples.db.LIST_PROJECTION
        )
        self.settings = self.bind_collection(
            "settings", projection=virtool.settings.db.PROJECTION
        )

        self.sequences = self.bind_collection("sequences")

        self.sessions = self.bind_collection("sessions", silent=True)

        self.status = self.bind_collection("status")

        self.subtraction = self.bind_collection(
            "subtraction", projection=virtool.subtractions.db.PROJECTION
        )

        self.users = self.bind_collection(
            "users", projection=virtool.users.db.PROJECTION
        )

    def bind_collection(self, name: str, processor=None, projection=None, silent=False):
        return Collection(
            name,
            self.motor_client[name],
            self.enqueue_change,
            processor,
            projection,
            silent,
        )

    @asynccontextmanager
    async def create_session(self):
        async with await self.motor_client.client.start_session() as s:
            async with s.start_transaction():
                yield s

    @asynccontextmanager
    async def with_session(self):
        async with await self.motor_client.client.start_session() as s:
            yield s
