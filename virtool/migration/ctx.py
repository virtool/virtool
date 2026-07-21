"""Context for migrations."""

import sys
from dataclasses import dataclass

import orjson
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from structlog import get_logger

from virtool.api.custom_json import dump_string
from virtool.config.cls import MigrationConfig
from virtool.pg.utils import get_sqlalchemy_url
from virtool.storage.factory import create_storage_backend
from virtool.storage.protocol import StorageBackend

logger = get_logger("migration")


@dataclass
class MigrationContext:
    pg: AsyncEngine
    storage: StorageBackend
    """The object-storage backend, for revisions that delete on-disk files."""


async def create_migration_context(config: MigrationConfig) -> MigrationContext:
    """Create a migration context that provides access to PostgreSQL.

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

    return MigrationContext(
        pg=pg,
        storage=create_storage_backend(config),
    )
