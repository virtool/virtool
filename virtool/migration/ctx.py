"""Context for migrations."""

import sys
from dataclasses import dataclass
from pathlib import Path

import orjson
from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorClientSession,
    AsyncIOMotorDatabase,
)
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from structlog import get_logger

import virtool.mongo.connect
from virtool.api.custom_json import dump_string
from virtool.config.cls import MigrationConfig
from virtool.pg.utils import get_sqlalchemy_url

logger = get_logger("migration")


@dataclass
class MigrationContextMongo:
    client: AsyncIOMotorClient
    database: AsyncIOMotorDatabase
    session: AsyncIOMotorClientSession


@dataclass
class RevisionContext:
    """A context for a specific revision upgrade or downgrade."""

    mongo: MigrationContextMongo
    """
    A Motor database utility class.

    Use this to read or change documents in MongoDB. 
    This client does not trigger websocket dispatches.
    """

    pg: AsyncSession
    """
    A SQLAlchemy database client.
    """


@dataclass
class MigrationContext:
    mongo: AsyncIOMotorDatabase
    pg: AsyncEngine
    data_path: Path


async def create_migration_context(config: MigrationConfig) -> MigrationContext:
    """Create a migration context that provides access to MongoDB and PostgreSQL.

    Connect to all data services and expose their clients
    in the returned context object.

    :param config: the migration configuration
    :return: the migration context

    """
    logger.info("connecting to postgres")

    try:
        pg = create_async_engine(
            get_sqlalchemy_url(config.pg_options),
            json_serializer=dump_string,
            json_deserializer=orjson.loads,
            pool_recycle=1800,
        )
    except ConnectionRefusedError:
        logger.critical("Could not connect to PostgreSQL: Connection refused")
        sys.exit(1)

    mongo_database = await virtool.mongo.connect.connect_motor_database(
        config.mongodb_connection_string,
        config.mongodb_name,
    )

    return MigrationContext(
        mongo=mongo_database,
        pg=pg,
        data_path=config.data_path,
    )
