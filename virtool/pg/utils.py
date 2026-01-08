import sys
from dataclasses import dataclass
from enum import Enum
from typing import TypeVar
from urllib.parse import parse_qs, urlparse

import orjson
from sqlalchemy import URL, select, text
from sqlalchemy.engine.result import ScalarResult
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from structlog import get_logger

from virtool.api.custom_json import dump_string
from virtool.pg.base import Base

logger = get_logger("pg")

RowType = TypeVar("RowType", bound=Base)
"""TypeVar for SQL row types."""


class SQLEnum(Enum):
    @classmethod
    def to_list(cls):
        return [e.value for e in cls]


@dataclass
class PgOptions:
    database: str
    host: str
    password: str
    port: int
    ssl: str
    username: str

    @staticmethod
    def from_connection_string(pg_connection_string: str):
        if not (
            pg_connection_string.startswith("postgresql://")
            or pg_connection_string.startswith("postgresql+asyncpg://")
        ):
            raise ValueError(
                "Invalid PostgreSQL connection string. Must start with 'postgresql://' or 'postgresql+asyncpg://'."
            )

        parsed_url = urlparse(pg_connection_string)
        parsed_query = parse_qs(parsed_url.query)

        database = parsed_url.path.lstrip("/")
        host = parsed_url.hostname
        port = parsed_url.port or 5432
        username = parsed_url.username
        ssl = parsed_query["ssl"][0] if "ssl" in parsed_query else "prefer"

        try:
            password = parsed_query["password"][0]
        except (KeyError, IndexError):
            password = parsed_url.password

        if not (host and username and password):
            raise ValueError(
                "Invalid PostgreSQL connection string. Missing host, username, or password."
            )

        return PgOptions(
            database=database,
            host=host,
            password=password,
            port=port,
            ssl=ssl,
            username=username,
        )


async def connect_pg(pg_options: PgOptions) -> AsyncEngine:
    """Create a connection to Postgres.

    :param postgres_connection_string: a standard postgres DSN (postgresql://...)
    :return: an AsyncEngine object
    """
    logger.info("connecting to postgres")

    try:
        pg = create_async_engine(
            get_sqlalchemy_url(pg_options),
            json_serializer=dump_string,
            json_deserializer=orjson.loads,
            pool_recycle=1800,
            pool_size=50,
            max_overflow=50,
            pool_timeout=60,
            pool_pre_ping=True,
        )

        await check_version(pg)

        return pg
    except ConnectionRefusedError:
        logger.critical("could not connect to postgres", reason="connection refused")
        sys.exit(1)


def get_sqlalchemy_url(pg_options: PgOptions) -> URL:
    """Convert a standard Postgres DSN to SQLAlchemy format.

    SQLAlchemy requires the driver to be specified (e.g., postgresql+asyncpg://).
    """
    return URL.create(
        "postgresql+asyncpg",
        username=pg_options.username,
        password=pg_options.password,
        host=pg_options.host,
        database=pg_options.database,
        query={"ssl": pg_options.ssl},
    )


async def check_version(engine: AsyncEngine) -> None:
    """Check and log the Postgres sever version.

    :param engine: an AsyncConnection object

    """
    async with AsyncSession(engine) as session:
        info = await session.execute(text("SHOW server_version"))

    version = info.first()[0].split()[0]
    logger.info("found postgres", version=version)


async def delete_row(pg: AsyncEngine, id_: int, model: type[Base]) -> None:
    """Deletes a row in the `model` SQL model by its row `id_`.

    :param pg: the application AsyncEngine object
    :param id_: Row `id` to delete from the given SQL model
    :param model: Table to delete row from
    """
    async with AsyncSession(pg) as session:
        row = await get_row_by_id(pg, model, id_)

        if row:
            await session.delete(row)
            await session.commit()


async def get_row_by_id(
    pg: AsyncEngine, model: type[RowType], id_: int
) -> RowType | None:
    """Get a row from a SQL `model` by its `id`.

    :param pg: the application AsyncEngine object
    :param model: A model to retrieve a row from
    :param id_: An SQL row `id`
    :return: Row from the given SQL model
    """
    return await get_row(pg, model, ("id", id_))


async def get_row(
    pg: AsyncEngine,
    model: type[RowType],
    match: tuple,
) -> RowType | None:
    """Get a row from the SQL `model` that matches a query and column combination.

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
    model: type[Base],
    filter_: str = "name",
    query: str | int | bool | SQLEnum | None = None,
) -> ScalarResult:
    """Get one or more rows from the `model` SQL model by its `filter_`.

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
    statement: type[Base],
) -> ScalarResult:
    """Generic function for getting data from SQL database.

    Executes the statement passed and returns the results as a scalar

    :param pg: the application AsyncEngine object
    :param statement: SQL statement to be executed
    :return: Results of the SQL request
    """
    async with AsyncSession(pg) as session:
        return (await session.execute(statement)).scalars()
