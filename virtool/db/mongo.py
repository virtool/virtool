import logging
import sys
from typing import Any, Callable, Dict, List

import pymongo.errors
from motor.motor_asyncio import AsyncIOMotorClient
from semver import VersionInfo

import virtool.db.core
import virtool.db.utils

MINIMUM_MONGO_VERSION = "3.6.0"

logger = logging.getLogger("mongo")


async def connect(
        config: Dict[str, Any],
        enqueue_change: Callable[[str, str, List[str]], None]
):
    """
    Connect to a MongoDB server and return an application database object.

    :param config: the application's configuration dictionary
    :param enqueue_change: a function that can to report change to the database

    """
    db_client = AsyncIOMotorClient(
        config["db_connection_string"],
        serverSelectionTimeoutMS=6000
    )

    try:
        await db_client.list_database_names()
    except pymongo.errors.ServerSelectionTimeoutError:
        logger.critical("Could not connect to MongoDB server")
        sys.exit(1)

    await check_mongo_version(db_client)

    db = db_client[config["db_name"]]

    return virtool.db.core.DB(
        db,
        enqueue_change
    )


async def check_mongo_version(db: AsyncIOMotorClient) -> str:
    """
    Check the MongoDB version. Log a critical error and exit if it is too old.

    :param db: the application database object
    :return: the MongoDB version
    """
    mongo_version = await get_mongo_version(db)

    if VersionInfo.parse(mongo_version) < VersionInfo.parse(MINIMUM_MONGO_VERSION):
        logger.critical(
            f"Virtool requires MongoDB {MINIMUM_MONGO_VERSION}. Found {mongo_version}."
        )
        sys.exit(1)

    logger.info(f"Found MongoDB {mongo_version}")

    return mongo_version


async def get_mongo_version(db: AsyncIOMotorClient) -> str:
    """
    Gets a server version string from the running MongoDB client.

    :param db: the application database object
    :return: MongoDB server version in string format
    """
    return (await db.motor_client.client.server_info())["version"]


async def create_indexes(db):
    """
    Create all MongoDB indexes.

    :param db: the application database object
    """
    await db.analyses.create_index("sample.id")
    await db.analyses.create_index([("created_at", pymongo.DESCENDING)])
    await db.caches.create_index([("key", pymongo.ASCENDING), ("sample.id", pymongo.ASCENDING)], unique=True)
    await db.history.create_index("otu.id")
    await db.history.create_index("index.id")
    await db.history.create_index("created_at")
    await db.history.create_index([("otu.name", pymongo.ASCENDING)])
    await db.history.create_index([("otu.version", pymongo.DESCENDING)])
    await db.indexes.create_index([("version", pymongo.ASCENDING), ("reference.id", pymongo.ASCENDING)], unique=True)
    await db.keys.create_index("id", unique=True)
    await db.keys.create_index("user.id")
    await db.otus.create_index([
        ("_id", pymongo.ASCENDING),
        ("isolate.id", pymongo.ASCENDING)
    ])
    await db.otus.create_index("name")
    await db.otus.create_index("nickname")
    await db.otus.create_index("abbreviation")
    await db.samples.create_index([("created_at", pymongo.DESCENDING)])
    await db.sequences.create_index("otu_id")
    await db.sequences.create_index("name")
    await db.users.create_index("ad_oid", unique=True, sparse=True)
    await db.users.create_index("handle", unique=True, sparse=True)
