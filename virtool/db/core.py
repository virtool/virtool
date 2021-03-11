"""
Core database classes.

The purpose of these classes is to automatically dispatch database changes via
:class:`Dispatcher` using the projections and processors appropriate for each collection.

"""
from typing import Any, Awaitable, Callable, Dict, Optional, Sequence, Union

import motor.motor_asyncio
import pymongo
import pymongo.errors
import pymongo.results
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.results import UpdateResult

import virtool.analyses.db
import virtool.caches.db
import virtool.db.utils
import virtool.errors
import virtool.history.db
import virtool.hmm.db
import virtool.indexes.db
import virtool.jobs.db
import virtool.otus.db
import virtool.references.db
import virtool.samples.db
import virtool.settings.db
import virtool.subtractions.db
import virtool.users.db
import virtool.uploads.db
import virtool.utils
from virtool.dispatcher.operations import DELETE, INSERT, UPDATE
from virtool.types import Projection


class Collection:
    """
    A wrapper for a Motor collection.

    Wraps collection methods that modify the database and automatically dispatches websocket
    messages to inform clients of the changes.

    """

    def __init__(
            self,
            name: str,
            collection: motor.motor_asyncio.AsyncIOMotorCollection,
            enqueue_change: Callable[[str, str, Sequence[str]], None],
            processor: Callable[[Any, Dict[str, Any]], Awaitable[Dict[str, Any]]],
            projection: Optional[Projection],
            silent: bool = False
    ):
        self.name = name
        self._collection = collection
        self._enqueue_change = enqueue_change
        self.processor = processor
        self.projection = projection
        self.silent = silent

        # No dispatches are necessary for these collection methods and they can be directly
        # referenced instead of wrapped.
        self.aggregate = self._collection.aggregate
        self.bulk_write = self._collection.bulk_write
        self.count_documents = self._collection.count_documents
        self.create_index = self._collection.create_index
        self.create_indexes = self._collection.create_indexes
        self.distinct = self._collection.distinct
        self.drop_index = self._collection.drop_index
        self.drop_indexes = self._collection.drop_indexes
        self.find_one = self._collection.find_one
        self.find = self._collection.find
        self.insert_many = self._collection.insert_many
        self.rename = self._collection.rename

    def apply_projection(self, document: dict) -> dict:
        """
        Apply the collection projection to the given document and return a new `dict`. If the
        collection `projection` attribute is not defined, the document will be returned unaltered.

        :param document: the document to apply the projection to
        :return: the projected document

        """
        if self.projection:
            return virtool.db.utils.apply_projection(document, self.projection)

        return document

    async def apply_processor(self, document):
        if self.processor:
            return await self.processor(self._collection.database, document)

        return virtool.utils.base_processor(document)

    def enqueue_change(self, operation: str, *id_list: str):
        """
        Dispatch updates if the collection is not `silent` and the `silent` parameter is `False`.
        Applies the collection projection and processor.

        :param operation: the operation to label the dispatch with (insert, update, delete)
        :param id_list: the document IDs the queue changes for

        """
        if not self.silent:
            self._enqueue_change(
                self.name,
                operation,
                id_list
            )

    async def delete_many(self, query: dict, silent: bool = False) -> pymongo.results.DeleteResult:
        """
        Delete many documents based on the passed `query`.

        :param query: a MongoDB query
        :param silent: don't dispatch websocket messages for this operation
        :return: the delete result

        """
        id_list = await self.distinct("_id", query)

        delete_result = await self._collection.delete_many(query)

        if not silent and len(id_list):
            self.enqueue_change(DELETE, *id_list)

        return delete_result

    async def delete_one(self, query: dict, silent: bool = False):
        """
        Delete a single document based on the passed `query`.

        :param query: a MongoDB query
        :param silent: don't dispatch websocket messages for this operation
        :return: the delete result

        """
        document_id = await virtool.db.utils.get_one_field(self._collection, "_id", query)
        delete_result = await self._collection.delete_one(query)

        if not silent and delete_result.deleted_count:
            self.enqueue_change(
                DELETE,
                document_id
            )

        return delete_result

    async def find_one_and_update(
            self,
            query: dict,
            update: dict,
            projection: Optional[Projection] = None,
            silent: bool = False,
            upsert: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Update a document and return the updated result.

        :param query: a MongoDB query used to select the documents to update
        :param update: a MongoDB update
        :param projection: a projection to apply to the returned document instead of the default
        :param silent: don't dispatch websocket messages for this operation
        :param upsert: insert a new document if the query doesn't match an existing document
        :return: the updated document

        """
        document = await self._collection.find_one_and_update(
            query,
            update,
            return_document=pymongo.ReturnDocument.AFTER,
            upsert=upsert
        )

        if document is None:
            return None

        if not silent:
            self.enqueue_change(UPDATE, document["_id"])

        if projection:
            return virtool.db.utils.apply_projection(document, projection)

        return document

    async def insert_one(self, document: Dict[str, Any], silent: bool = False) -> Dict[str, Any]:
        """
        Insert the `document`.

        If no `_id` is included in the `document`, one will be autogenerated. If a provided `_id`
        already exists, a :class:`DuplicateKeyError` will be raised.

        :param document: the document to insert
        :param silent: don't dispatch the change to connected clients
        :return: the inserted document

        """
        generate_id = "_id" not in document

        if generate_id:
            document["_id"] = virtool.utils.random_alphanumeric(8)

        try:
            await self._collection.insert_one(document)

            if not silent:
                self.enqueue_change(INSERT, document["_id"])

            return document
        except pymongo.errors.DuplicateKeyError:
            if generate_id:
                document.pop("_id")
                return await self._collection.insert_one(document)

            raise

    async def replace_one(
            self,
            query: Dict[str, Any],
            replacement: Dict[str, Any],
            upsert: bool = False
    ):
        """
        Replace the document identified using `query` with the `replacement` document.

        :param query: the query used to find a document to replace
        :param replacement: the replacement document
        :param upsert: insert a new document if nothing matches the query

        """
        document = await self._collection.find_one_and_replace(
            query,
            replacement,
            projection=self.projection,
            upsert=upsert
        )

        self.enqueue_change(
            UPDATE,
            replacement["_id"]
        )

        return document

    async def update_many(
            self,
            query: Union[str, Dict],
            update: Dict,
            silent: bool = False
    ) -> UpdateResult:
        """
        Update all documents that match `query` by applying the `update`.

        :param query: the query to match
        :param update: the update to apply to matching documents
        :param silent: don't dispatch the change to connected clients

        """
        updated_ids = await self._collection.distinct("_id", query)
        update_result = await self._collection.update_many(query, update)

        if not silent:
            self.enqueue_change(
                UPDATE,
                *updated_ids
            )

        return update_result

    async def update_one(
            self,
            query: Union[str, Dict],
            update: Dict,
            upsert: bool = False,
            silent: bool = False
    ) -> UpdateResult:
        """
        Update one document matching the `query` by applying the `update`.

        :param query: the query to match
        :param update: the update to apply to matching document
        :param upsert: insert a new document if there is no match for the query
        :param silent: don't dispatch the change to connected clients

        """
        document = await self.find_one(query, ["_id"])
        update_result = await self._collection.update_one(query, update, upsert=upsert)

        if not silent and document:
            self.enqueue_change(
                UPDATE,
                document["_id"]
            )

        return update_result


class DB:

    def __init__(
            self,
            motor_client: AsyncIOMotorClient,
            enqueue_change: Callable[[str, str, Sequence[str]], None]
    ):
        self.motor_client = motor_client
        self.enqueue_change = enqueue_change

        self.analyses = self.bind_collection(
            "analyses",
            projection=virtool.analyses.db.PROJECTION
        )

        self.caches = self.bind_collection(
            "caches",
            projection=virtool.caches.db.PROJECTION
        )

        self.coverage = self.bind_collection(
            "coverage",
            silent=True
        )

        self.files = self.bind_collection(
            "files",
            projection=virtool.upl.db.PROJECTION
        )

        self.groups = self.bind_collection("groups")

        self.history = self.bind_collection(
            "history",
            projection=virtool.history.db.PROJECTION
        )

        self.hmm = self.bind_collection(
            "hmm",
            projection=virtool.hmm.db.PROJECTION
        )

        self.indexes = self.bind_collection(
            "indexes",
            projection=virtool.indexes.db.PROJECTION
        )

        self.jobs = self.bind_collection(
            "jobs",
            projection=virtool.jobs.db.LIST_PROJECTION,
            processor=virtool.jobs.db.processor
        )

        self.keys = self.bind_collection(
            "keys",
            silent=True
        )

        self.kinds = self.bind_collection(
            "kinds",
            silent=True
        )

        self.labels = self.bind_collection("labels")

        self.otus = self.bind_collection(
            "otus",
            projection=virtool.otus.db.PROJECTION
        )

        self.tasks = self.bind_collection(
            "tasks"
        )

        self.references = self.bind_collection(
            "references",
            processor=virtool.references.db.processor,
            projection=virtool.references.db.PROJECTION
        )

        self.samples = self.bind_collection(
            "samples",
            projection=virtool.samples.db.LIST_PROJECTION
        )
        self.settings = self.bind_collection(
            "settings",
            projection=virtool.settings.db.PROJECTION
        )

        self.sequences = self.bind_collection("sequences")

        self.sessions = self.bind_collection(
            "sessions",
            silent=True
        )

        self.status = self.bind_collection("status")

        self.subtraction = self.bind_collection(
            "subtraction",
            projection=virtool.subtractions.db.PROJECTION
        )

        self.users = self.bind_collection(
            "users",
            projection=virtool.users.db.PROJECTION
        )

    def bind_collection(self, name: str, processor=None, projection=None, silent=False):
        return Collection(
            name,
            self.motor_client[name],
            self.enqueue_change,
            processor,
            projection,
            silent
        )

    def get_processor(self, collection_name):
        return self.__getattribute__(collection_name).apply_processor

    def get_projection(self, collection_name):
        return self.__getattribute__(collection_name).projection
