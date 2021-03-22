import logging
import sys
from enum import Enum
from typing import Optional, Union

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from virtool.pg.Base import Base

logger = logging.getLogger(__name__)


class SQLEnum(Enum):
    @classmethod
    def to_list(cls):
        return [e.value for e in cls]


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
        pg = create_async_engine(postgres_connection_string)

        await check_version(pg)
        await create_models(pg)

        return pg
    except ConnectionRefusedError:
        logger.fatal("Could not connect to PostgreSQL: Connection refused")
        sys.exit(1)


async def check_version(engine: AsyncEngine):
    """
    Check and log the Postgres sever version.

    :param engine: an AsyncConnection object

    """
    async with engine.connect() as conn:
        info = await conn.execute(text("SHOW server_version"))

    version = info.first()[0].split()[0]
    logger.info(f"Found PostgreSQL {version}")


async def create_models(engine):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def delete_row(pg: AsyncEngine, id_: int, model: Base):
    """
    Deletes a row in the `model` SQL model by its row `id_`.

    :param pg: PostgreSQL AsyncEngine object
    :param id_: Row `id` to delete from the given SQL model
    :param model: Table to delete row from
    """
    async with AsyncSession(pg) as session:
        row = (await session.execute(select(model).filter(model.id == id_))).scalar()

        if not row:
            return None

        session.delete(row)

        await session.commit()


async def get_row(
    pg: AsyncEngine,
    query: Union[str, int, bool, SQLEnum],
    model: Base,
    filter_: str = "id",
) -> Optional[Base]:
    """
    Get a row from the `model` SQL model by its `filter_`. By default, a row will be fetched by its `id`.

    :param pg: PostgreSQL AsyncEngine object
    :param query: A query to filter by
    :param model: A model to retrieve a row from
    :param filter_: A table column to search for a given `query`
    :return: Row from the given SQL model
    """
    async with AsyncSession(pg) as session:
        row = (
            await session.execute(
                select(model).filter(getattr(model, filter_) == query)
            )
        ).scalar()

        if not row:
            return None

    return row
