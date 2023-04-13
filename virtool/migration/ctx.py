import asyncio
import sys
from dataclasses import dataclass
from logging import getLogger

from motor.motor_asyncio import (
    AsyncIOMotorClient,
    AsyncIOMotorClientSession,
    AsyncIOMotorDatabase,
)
from openfga_sdk import OpenFgaApi
from orjson import orjson
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

import virtool.mongo.connect
from virtool.api.custom_json import dump_string
from virtool.authorization.utils import connect_openfga
from virtool.config.cls import MigrationConfig

logger = getLogger("migration")


@dataclass
class MigrationContextMongo:
    client: AsyncIOMotorClient
    database: AsyncIOMotorDatabase


@dataclass
class RevisionContext:
    """
    A context for a specific revision upgrade or downgrade.


    """

    mongo: AsyncIOMotorClientSession
    openfga: OpenFgaApi
    pg: AsyncSession


@dataclass
class MigrationContext:
    mongo: MigrationContextMongo
    openfga: OpenFgaApi
    pg: AsyncEngine

    async def with_revision_context(self):
        async with AsyncSession(
            self.pg
        ) as pg, self.mongo.client.start_session() as mongo:
            yield RevisionContext(mongo, self.openfga, pg)


async def create_migration_context(config: MigrationConfig) -> MigrationContext:
    """
    Create a migration context that provides access to MongoDB, OpenFGA, and PostgreSQL.

    Connect to all data services and expose their clients in the returned context object.

    :param config: the migration configuration
    :return: the migration context

    """
    if not config.postgres_connection_string.startswith("postgresql+asyncpg://"):
        logger.critical("Invalid PostgreSQL connection string")
        sys.exit(1)

    logger.info("Connecting to PostgreSQL")

    try:
        pg = create_async_engine(
            config.postgres_connection_string,
            json_serializer=dump_string,
            json_deserializer=orjson.loads,
            pool_recycle=1800,
        )
    except ConnectionRefusedError:
        logger.critical("Could not connect to PostgreSQL: Connection refused")
        sys.exit(1)

    mongo_database, openfga = await asyncio.gather(
        virtool.mongo.connect.connect(
            config.mongodb_connection_string,
            config.mongodb_name,
            skip_revision_check=True,
        ),
        connect_openfga(
            config.openfga_host, config.openfga_scheme, config.openfga_store_name
        ),
    )

    return MigrationContext(
        mongo=MigrationContextMongo(
            client=mongo_database.mongo_client,
            database=AsyncIOMotorClient(
                config.mongodb_connection_string
            ).get_default_database(),
        ),
        openfga=openfga,
        pg=pg,
    )
