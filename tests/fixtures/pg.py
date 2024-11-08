"""Fixtures for working with the Postgres testing instance."""

import asyncio

import orjson
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from virtool.api.custom_json import dump_string
from virtool.pg.utils import Base


@pytest.fixture(scope="session")
def pg_base_connection_string(request, pg_db_name: str):
    """A Postgres connection string without the database name at the end.

    This is used to manage databases in the Postgres instance. It is used by
    migration-specific fixtures like :func:`migration_pg` to create and drop databases.

    eg. ``postgresql+asyncpg://virtool:virtool@localhost``

    """
    return request.config.getoption("postgres_connection_string")


@pytest.fixture(scope="session")
def pg_db_name(worker_id: str):
    """An auto-generated Postgres database name. One database is generated for each xdist worker.

    eg. test_2 (for worker-2)

    """
    return f"vt_test_{worker_id}"


@pytest.fixture(scope="session")
def pg_connection_string(pg_base_connection_string: str, pg_db_name: str):
    """A full Postgres connection string with the auto-generated test database name
    appended.

     eg. postgresql+asyncpg://virtool:virtool@localhost/test_2

    """
    return f"{pg_base_connection_string}/{pg_db_name}"


@pytest.fixture(scope="session")
def event_loop():
    """Overrides pytest default function scoped event loop"""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def engine(
    pg_db_name: str,
    pg_base_connection_string: str,
    pg_connection_string: str,
) -> AsyncEngine:
    """Return a SQLAlchemy :class:`AsyncEngine` object for an auto-generated test database.

    Test database are specific to xdist workers.

    """
    engine_without_db = create_async_engine(
        pg_base_connection_string,
        isolation_level="AUTOCOMMIT",
    )

    async with engine_without_db.connect() as conn:
        await conn.execute(
            text(
                f"DROP DATABASE IF EXISTS {pg_db_name};",
            ),
        )
        await conn.execute(
            text(
                f"CREATE DATABASE {pg_db_name};",
            ),
        )

    engine = create_async_engine(
        pg_connection_string,
        echo=False,
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.commit()

    yield engine

    await engine.dispose()


@pytest.fixture()
async def pg(engine: AsyncEngine):
    async with AsyncSession(engine) as session:
        tables = ",".join(table.name for table in Base.metadata.sorted_tables)

        await session.execute(
            text(
                f"""
                TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE;
                """,
            ),
        )

        await session.commit()

    return engine
