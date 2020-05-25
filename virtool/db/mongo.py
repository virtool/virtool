import logging
import sys

import motor.motor_asyncio
import pymongo.errors
import semver

import virtool.db.core
import virtool.db.utils

MINIMUM_MONGO_VERSION = "3.6.0"

logger = logging.getLogger("mongo")


async def connect(config, dispatch):
    db_client = motor.motor_asyncio.AsyncIOMotorClient(
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
        dispatch
    )


async def check_mongo_version(db):
    """
    Check the MongoDB version. Log a critical error and exit if it is too old.

    :param db: the application database object
    :param logger: the app logger

    """
    server_version = (await db.server_info())["version"]

    if semver.compare(server_version, MINIMUM_MONGO_VERSION) == -1:
        logger.critical(f"Virtool requires MongoDB {MINIMUM_MONGO_VERSION}. Found {server_version}.")
        sys.exit(1)

    logger.info(f"Found MongoDB {server_version}.")


