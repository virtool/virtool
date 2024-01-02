"""
Utilities for working with MongoDB.

"""
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorCollection

from virtool.types import Projection, Document


def apply_projection(document: Document, projection: Projection):
    """
    Apply a Mongo-style projection to a document and return it.

    :param document: the document to project
    :param projection: the projection to apply
    :return: the projected document

    """
    if isinstance(projection, (list, tuple)):
        if "_id" not in projection:
            projection.append("_id")

        return {key: document[key] for key in document if key in projection}

    if not isinstance(projection, dict):
        raise TypeError(f"Invalid type for projection: {type(projection)}")

    if projection == {"_id": False}:
        return {key: document[key] for key in document if key != "_id"}

    if all(value is False for value in projection.values()):
        return {key: document[key] for key in document if key not in projection}

    if "_id" not in projection:
        projection["_id"] = True

    return {key: document[key] for key in document if projection.get(key, False)}


async def check_missing_ids(
    collection: AsyncIOMotorCollection,
    id_list: list,
    query: dict | None = None,
    session: AsyncIOMotorClientSession | None = None,
) -> set[str]:
    """
    Check if all IDs in the ``id_list`` exist in the database.

    :param collection: the Mongo collection to check ``id_list`` against
    :param id_list: the IDs to check for
    :param query: a mongodb query
    :param session: a motor session to use
    :return: all non-existent IDs

    """
    return set(id_list) - set(await collection.distinct("_id", query, session=session))


async def delete_unready(collection):
    """
    Delete documents in the `collection` where the `ready` field is set to `false`.

    :param collection: the collection to modify

    """
    await collection.delete_many({"ready": False})


async def get_new_id(
    collection, session: AsyncIOMotorClientSession | None = None
) -> str:
    """
    Returns a new, unique, id that can be used for inserting a new document. Will not
    return any id that is included in ``excluded``.

    :param collection: the Mongo collection to get a new _id for
    :param session: a motor session to use
    :return: an ID unique within the collection

    """
    id_ = collection.mongo.id_provider.get()

    if await collection.count_documents({"_id": id_}, limit=1, session=session):
        return await get_new_id(collection, session=session)

    return id_


async def get_one_field(
    collection,
    field: str,
    query: str | dict,
    session: AsyncIOMotorClientSession | None = None,
) -> Any:
    """
    Get the value for a single `field` from a single document matching the `query`.

    :param collection: the database collection to search
    :param field: the field to return
    :param query: the document matching query
    :param session: a Motor session to use for database operations
    :return: the field

    """
    if projected := await collection.find_one(query, [field], session=session):
        return projected.get(field)

    return None


async def get_non_existent_ids(collection, id_list: list[str]) -> set[str]:
    """
    Return the IDs that are in `id_list`, but don't exist in the specified `collection`.

    :param collection: the database collection to check
    :param id_list: a list of document IDs to check for existence
    :return: a list of non-existent IDs

    """
    existing_group_ids = await collection.distinct("_id", {"_id": {"$in": id_list}})
    return set(id_list) - set(existing_group_ids)


async def id_exists(
    collection, id_: str, session: AsyncIOMotorClientSession | None = None
) -> bool:
    """
    Check if the document id exists in the collection.

    :param collection: the Mongo collection to check the _id against
    :param id_: the _id to check for
    :return: does the id exist
    """
    return bool(
        await collection.count_documents({"_id": id_}, limit=1, session=session)
    )
