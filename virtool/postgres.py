import logging
import sys

from sqlalchemy import text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

logger = logging.getLogger(__name__)

Base = declarative_base()


async def connect(postgres_connection_string: str) -> AsyncEngine:
    """
    Create a connection of Postgres.

    :param postgres_connection_string: the postgres connection string
    :return: an AsyncEngine object

    """
    if not postgres_connection_string.startswith("postgresql+asyncpg://"):
        logger.fatal("Invalid PostgreSQL connection string")
        sys.exit(1)

    try:
        postgres = create_async_engine(postgres_connection_string)

        await check_version(postgres)
        await create_tables(postgres)

        return postgres
    except ConnectionRefusedError:
        logger.fatal("Could not connect to PostgreSQL: Connection refused")
        sys.exit(1)


async def check_version(engine: AsyncEngine):
    """
    Check and log the Postgres sever version.

    :param engine: an AsyncConnection object

    """
    async with engine.connect() as conn:
        info = await conn.execute(text('SHOW server_version'))

    version = info.first()[0].split()[0]
    logger.info(f"Found PostgreSQL {version}")


async def create_tables(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
