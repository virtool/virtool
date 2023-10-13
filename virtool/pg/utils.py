import sys
from enum import Enum
from typing import Optional, Type, Union

import orjson
from sqlalchemy import select, text
from sqlalchemy.engine.result import ScalarResult
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from structlog import get_logger

from virtool.api.custom_json import dump_string
from virtool.pg.base import Base

logger = get_logger("pg")


class SQLEnum(Enum):
    @classmethod
    def to_list(cls):
        return [e.value for e in cls]


async def connect_pg(postgres_connection_string: str) -> AsyncEngine:
    """
    Create a connection of Postgres.

    :param postgres_connection_string: the postgres connection string
    :return: an AsyncEngine object

    """
    if not postgres_connection_string.startswith("postgresql+asyncpg://"):
        logger.critical("Invalid PostgreSQL connection string")
        sys.exit(1)

    logger.info("Connecting to PostgreSQL")

    try:
        pg = create_async_engine(
            postgres_connection_string,
            json_serializer=dump_string,
            json_deserializer=orjson.loads,
            pool_recycle=1800,
        )

        await check_version(pg)

        return pg
    except ConnectionRefusedError:
        logger.critical("Could not connect to PostgreSQL: Connection refused")
        sys.exit(1)


async def check_version(engine: AsyncEngine):
    """
    Check and log the Postgres sever version.

    :param engine: an AsyncConnection object

    """
    async with AsyncSession(engine) as session:
        info = await session.execute(text("SHOW server_version"))

    version = info.first()[0].split()[0]
    logger.info("Found PostgreSQL", version=version)


async def delete_row(pg: AsyncEngine, id_: int, model: Type[Base]):
    """
    Deletes a row in the `model` SQL model by its row `id_`.

    :param pg: the application AsyncEngine object
    :param id_: Row `id` to delete from the given SQL model
    :param model: Table to delete row from
    """
    async with AsyncSession(pg) as session:
        row = await get_row_by_id(pg, model, id_)

        if row:
            await session.delete(row)
            await session.commit()


async def get_row_by_id(pg: AsyncEngine, model: Type[Base], id_: int) -> Base | None:
    """
    Get a row from a SQL `model` by its `id`.

    :param pg: the application AsyncEngine object
    :param model: A model to retrieve a row from
    :param id_: An SQL row `id`
    :return: Row from the given SQL model
    """
    return await get_row(pg, model, ("id", id_))


async def get_row(pg: AsyncEngine, model: Type[Base], match: tuple) -> Optional[Base]:
    """
    Get a row from the SQL `model` that matches a query and column combination.

    :param pg: the application AsyncEngine object
    :param model: a model to retrieve a row from
    :param match: a (column, value) tuple to filter results by
    :return: row from the given SQL model
    """
    (column, value) = match
    async with AsyncSession(pg) as session:
        return (
            await session.execute(select(model).where(getattr(model, column) == value))
        ).scalar()


async def get_rows(
    pg: AsyncEngine,
    model: Type[Base],
    filter_: str = "name",
    query: Optional[Union[str, int, bool, SQLEnum]] = None,
) -> ScalarResult:
    """
    Get one or more rows from the `model` SQL model by its `filter_`.

    By default, rows will be fetched by their `name`.

    :param pg: the application AsyncEngine object
    :param query: A query to filter by
    :param model: A model to retrieve a row from
    :param filter_: A table column to search for a given `query`
    :return: Row from the given SQL model
    """
    async with AsyncSession(pg) as session:
        statement = (
            select(model).where(getattr(model, filter_).ilike(f"%{query}%"))
            if query
            else select(model)
        )

        return (await session.execute(statement)).scalars()


async def get_generic(
    pg: AsyncEngine,
    statement: Type[Base],
) -> ScalarResult:
    """
    Generic function for getting data from SQL database.

    Executes the statement passed and returns the results as a scalar

    :param pg: the application AsyncEngine object
    :param statement: SQL statement to be executed
    :return: Results of the SQL request
    """
    async with AsyncSession(pg) as session:
        return (await session.execute(statement)).scalars()
