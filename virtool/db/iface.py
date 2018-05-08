import pymongo
import pymongo.errors
from motor import motor_asyncio

import virtool.db.analyses
import virtool.db.files
import virtool.db.history
import virtool.db.hmm
import virtool.db.indexes
import virtool.db.jobs
import virtool.db.otus
import virtool.db.references
import virtool.db.samples
import virtool.db.subtractions
import virtool.db.users
import virtool.db.utils
import virtool.errors
import virtool.utils

COLLECTION_NAMES = [
    "analyses",
    "files",
    "groups",
    "history",
    "hmm",
    "indexes",
    "jobs",
    "keys",
    "kinds",
    "otus",
    "processes",
    "refs",
    "samples",
    "sequences",
    "sessions",
    "status",
    "subtraction",
    "users"
]


class Collection:

    def __init__(self, name, collection, dispatch, processor, projection, silent=False):
        self.name = name
        self._collection = collection
        self.dispatch = dispatch
        self.processor = processor
        self.projection = projection
        self.silent = silent

        self.aggregate = self._collection.aggregate
        self.count = self._collection.count
        self.create_index = self._collection.create_index
        self.create_indexes = self._collection.create_indexes
        self.distinct = self._collection.distinct
        self.drop_index = self._collection.drop_index
        self.drop_indexes = self._collection.drop_indexes
        self.find_one = self._collection.find_one
        self.find = self._collection.find
        self.rename = self._collection.rename

    async def delete_many(self, query, silent=False):
        id_list = await self.distinct("_id", query)

        delete_result = await self._collection.delete_many(query)

        if not silent and not self.silent and len(id_list):
            await self.dispatch(self._collection.name, "delete", id_list)

        return delete_result

    async def delete_one(self, query, silent=False):
        document = await self._collection.find_one(query, ["_id"])

        delete_result = await self._collection.delete_one(query)

        if not silent and not self.silent and document:
            id_list = [document["_id"]]
            await self.dispatch(self._collection.name, "delete", id_list)

        return delete_result

    async def find_one_and_update(self, query, update, projection=None, silent=False):
        document = await self._collection.find_one_and_update(
            query,
            update,
            return_document=pymongo.ReturnDocument.AFTER
        )

        if not silent and not self.silent:
            await self.dispatch(self.name, "update", self.processor(document))

        if projection:
            return virtool.db.utils.apply_projection(document, projection)

        return document

    async def insert_one(self, document, silent=False):
        generate_id = "_id" not in document

        if generate_id:
            document["_id"] = virtool.utils.random_alphanumeric(8)

        try:
            await self._collection.insert_one(document)
        except pymongo.errors.DuplicateKeyError:
            if generate_id:
                document.pop("_id")
                return await self._collection.insert_one(document)

            raise

        if not silent and not self.silent:
            await self.dispatch(self.name, "insert", self.processor(document))

        return document

    async def update_many(self, query, update, silent=False):
        updated_ids = await self._collection.distinct("_id", query)

        update_result = await self._collection.update_many(query, update)

        if not silent and not self.silent:
            async for document in self._collection.find({"_id": {"$in": updated_ids}}):
                await self.dispatch(self.name, "update", self.processor(document))

        return update_result

    async def update_one(self, query, update, upsert=False, silent=False):
        document = await self.find_one(query, ["_id"])

        update_result = await self._collection.update_one(query, update, upsert=upsert)

        if document:
            document = await self.find_one(document["_id"])
        else:
            document = await self.find_one(query)

        if not silent and not self.silent and document:
            await self.dispatch(self.name, "update", self.processor(document))

        return update_result


class DB:

    def __init__(self, app):
        self.dispatch = app["dispatcher"].dispatch
        self.loop = app.loop

        self.name = app.get("db_name", None) or app["settings"].get("db_name")

        self.host = app["settings"].get("db_host", "localhost")
        self.port = app["settings"].get("db_port", 27017)

        for collection_name in COLLECTION_NAMES:
            setattr(self, collection_name, None)

        self._db = None

    async def connect(self):
        client = motor_asyncio.AsyncIOMotorClient(
            self.host,
            self.port,
            serverSelectionTimeoutMS=6000,
            io_loop=self.loop
        )

        try:
            await client.database_names()
        except pymongo.errors.ServerSelectionTimeoutError:
            raise virtool.errors.MongoConnectionError(
                "Could not connect to MongoDB server at {}:{}".format(self.host, self.port)
            )

        self._db = client[self.name]

        await self.bind_collection("analyses", projection=virtool.db.analyses.PROJECTION)
        await self.bind_collection("files", projection=virtool.db.files.PROJECTION)
        await self.bind_collection("groups")
        await self.bind_collection("history", projection=virtool.db.history.LIST_PROJECTION)
        await self.bind_collection("hmm", projection=virtool.db.hmm.PROJECTION)
        await self.bind_collection("indexes", projection=virtool.db.indexes.PROJECTION)
        await self.bind_collection("jobs", projection=virtool.db.jobs.PROJECTION, processor=virtool.db.jobs.processor)
        await self.bind_collection("keys", silent=True)
        await self.bind_collection("kinds", silent=True)
        await self.bind_collection("otus", projection=virtool.db.otus.PROJECTION)
        await self.bind_collection("processes")
        await self.bind_collection("refs", projection=virtool.db.references.PROJECTION)
        await self.bind_collection("samples", projection=virtool.db.samples.LIST_PROJECTION)
        await self.bind_collection("sequences")
        await self.bind_collection("sessions", silent=True)
        await self.bind_collection("status")
        await self.bind_collection("subtraction", projection=virtool.db.subtractions.PROJECTION)
        await self.bind_collection("users", projection=virtool.db.users.PROJECTION)

    async def bind_collection(self, name, processor=None, projection=None, silent=False):
        collection = Collection(
            name,
            self._db[name],
            self.dispatch,
            processor or virtool.utils.base_processor,
            projection,
            silent
        )

        setattr(self, name, collection)

    async def collection_names(self):
        return await self._db.collection_names()
