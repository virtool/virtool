import sys
from logging import getLogger

from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorClient
from pymongo import DESCENDING, ASCENDING
from pymongo.errors import ServerSelectionTimeoutError
from semver import VersionInfo

MINIMUM_MONGO_VERSION = "3.6.0"

REQUIRED_MONGODB_REVISION = "6q5k8tz8uph3"

logger = getLogger("mongo")


async def connect(
    db_connection_string: str, db_name: str, skip_revision_check: bool
) -> AsyncIOMotorDatabase:
    """
    Connect to a MongoDB server and return an application database object.

    :param db_connection_string: the mongoDB connection string
    :param db_name: the database name
    :param skip_revision_check: skips check for required MongoDB revision if set
    :return: database

    """
    db_client = AsyncIOMotorClient(db_connection_string, serverSelectionTimeoutMS=6000)

    logger.info("Connecting to MongoDB")

    try:
        await db_client.list_database_names()
    except ServerSelectionTimeoutError:
        logger.critical("Could not connect to MongoDB server")
        sys.exit(1)

    await check_mongo_version(db_client)

    if not skip_revision_check:
        await check_revision(db_client[db_name])

    return db_client[db_name]


async def check_revision(db: AsyncIOMotorDatabase):
    """
    Check if the required MongoDB revision has been applied.

    Log a fatal error and exit if the required revision
    has not been applied.

    :param db: the application database object
    """
    if not await db.migrations.find_one({"revision_id": REQUIRED_MONGODB_REVISION}):
        logger.fatal(
            "The required MongoDB revision has not been applied: %s.",
            REQUIRED_MONGODB_REVISION,
        )
        sys.exit(1)


async def check_mongo_version(db: AsyncIOMotorClient) -> str:
    """
    Check the MongoDB version.

    Log a critical error and exit if it is too old. Return it otherwise.

    :param db: the application database object
    :return: the MongoDB version
    """
    mongo_version = await get_mongo_version(db)

    if VersionInfo.parse(mongo_version) < VersionInfo.parse(MINIMUM_MONGO_VERSION):
        logger.critical(
            "Virtool requires MongoDB %s. Found %s.",
            MINIMUM_MONGO_VERSION,
            mongo_version,
        )
        sys.exit(1)

    logger.info("Found MongoDB %s", mongo_version)

    return mongo_version


async def get_mongo_version(db: AsyncIOMotorClient) -> str:
    """
    Gets a server version string from the running MongoDB client.

    :param db: the application database object
    :return: MongoDB server version in string format

    """
    return (await db.motor_client.client.server_info())["version"]
