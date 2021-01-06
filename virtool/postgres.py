import logging
import sys

import sqlalchemy
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

logger = logging.getLogger(__name__)


async def connect(postgres_connection_string: str) -> sqlalchemy.engine:
    if not postgres_connection_string.startswith("postgresql://"):
        logger.fatal("Invalid PostgreSQL connection string")
        sys.exit(1)

    try:
        postgres = create_async_engine(postgres_connection_string)
        async with postgres.connect() as connection:
            await check_version(connection)

            return connection
    except ConnectionRefusedError:
        logger.fatal("Could not connect to PostgreSQL: Connection refused")
        sys.exit(1)


async def check_version(connection):
    info = await connection.execute(text('SHOW server_version'))

    version = info.first()[0].split()[0]
    logger.info(f"Found PostgreSQL {version}")
    return
