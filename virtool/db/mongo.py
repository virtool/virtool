import logging
import sys
from typing import Any, Awaitable, Callable, Dict, List

import pymongo.errors
import semver
from motor.motor_asyncio import AsyncIOMotorClient

import virtool.db.core
import virtool.db.utils

MINIMUM_MONGO_VERSION = "3.6.0"

logger = logging.getLogger("mongo")


async def connect(
        config: Dict[str, Any],
        enqueue_change: Callable[[str, str, List[str]], Awaitable[None]]
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


async def check_mongo_version(db: AsyncIOMotorClient):
    """
    Check the MongoDB version. Log a critical error and exit if it is too old.

    :param db: the application database object

    """
    server_version = await get_server_version(db)

    if semver.compare(server_version, MINIMUM_MONGO_VERSION) == -1:
        logger.critical(
            f"Virtool requires MongoDB {MINIMUM_MONGO_VERSION}. Found {server_version}."
        )
        sys.exit(1)

    logger.info(f"Found MongoDB {server_version}")


async def get_server_version(db: AsyncIOMotorClient) -> str:
    return (await db.server_info())["version"]
