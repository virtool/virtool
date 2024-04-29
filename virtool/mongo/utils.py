"""Utilities for working with MongoDB."""

from typing import TYPE_CHECKING, Any

from aiohttp.web import Request
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorCollection

from virtool.types import App

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


async def check_missing_ids(
    collection: AsyncIOMotorCollection,
    id_list: list,
    query: dict | None = None,
    session: AsyncIOMotorClientSession | None = None,
) -> set[str]:
    """Check if all IDs in the ``id_list`` exist in the database.

    :param collection: the Mongo collection to check ``id_list`` against
    :param id_list: the IDs to check for
    :param query: a mongodb query
    :param session: a motor session to use
    :return: all non-existent IDs

    """
    return set(id_list) - set(await collection.distinct("_id", query, session=session))


def get_mongo_from_app(app: App) -> "Mongo":
    """Get the MongoDB client object from the application object.

    :param app: the application object
    :return: the MongoDB connection object

    """
    return app["mongo"]


def get_mongo_from_req(req: Request) -> "Mongo":
    """Get the MongoDB client object from the request object.

    :param req: the request object
    :return: the MongoDB connection object

    """
    return get_mongo_from_app(req.app)


async def get_new_id(
    collection,
    session: AsyncIOMotorClientSession | None = None,
) -> str:
    """Returns a new, unique, id that can be used for inserting a new document. Will not
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
    """Get the value for a single `field` from a single document matching the `query`.

    :param collection: the database collection to search
    :param field: the field to return
    :param query: the document matching query
    :param session: a Motor session to use for database operations
    :return: the field

    """
    if projected := await collection.find_one(query, [field], session=session):
        return projected.get(field)

    return None


async def id_exists(
    collection,
    id_: str,
    session: AsyncIOMotorClientSession | None = None,
) -> bool:
    """Check if the document id exists in the collection.

    :param collection: the Mongo collection to check the _id against
    :param id_: the _id to check for
    :return: does the id exist
    """
    return bool(
        await collection.count_documents({"_id": id_}, limit=1, session=session),
    )
