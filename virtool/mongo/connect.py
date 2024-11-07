import sys

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import OperationFailure, ServerSelectionTimeoutError
from semver import VersionInfo
from structlog import get_logger

from virtool.mongo.core import Mongo
from virtool.mongo.identifier import RandomIdProvider

MINIMUM_MONGO_VERSION = "3.6.0"


logger = get_logger("mongo")


async def connect_motor_database(
    connection_string: str,
    db_name: str,
) -> AsyncIOMotorDatabase:
    """Connect to a MongoDB server and return an application database object.

    :param connection_string: the mongoDB connection string
    :param db_name: the database name
    :return: database

    """
    mongo_client = AsyncIOMotorClient(connection_string, serverSelectionTimeoutMS=6000)

    logger.info("connecting to mongo")

    try:
        await mongo_client.list_database_names()
    except (OperationFailure, ServerSelectionTimeoutError) as err:
        logger.critical("could not connect to mongo", err=err)
        sys.exit(1)

    await check_mongo_version(mongo_client)

    return mongo_client[db_name]


async def connect_mongo(connection_string: str, db_name: str) -> Mongo:
    """Connect to a MongoDB server and return an application database object.

    :param connection_string: the mongoDB connection string
    :param db_name: the database name
    :return: database

    """
    motor_database = await connect_motor_database(connection_string, db_name)
    return Mongo(motor_database, RandomIdProvider())


async def check_mongo_version(mongo: AsyncIOMotorClient) -> str:
    """Check the MongoDB version.

    Log a critical error and exit if it is too old. Return it otherwise.

    :param mongo: the application database object
    :return: the MongoDB version
    """
    mongo_version = await get_mongo_version(mongo)

    if VersionInfo.parse(mongo_version) < VersionInfo.parse(MINIMUM_MONGO_VERSION):
        logger.critical(
            "MongoDB is too old",
            minimum_version=MINIMUM_MONGO_VERSION,
            version=mongo_version,
        )

        sys.exit(1)

    logger.info("found mongo", version=mongo_version)

    return mongo_version


async def get_mongo_version(mongo: AsyncIOMotorClient) -> str:
    """Gets a server version string from the running MongoDB client.

    :param mongo: the application database object
    :return: MongoDB server version in string format

    """
    return (await mongo.motor_client.client.server_info())["version"]
