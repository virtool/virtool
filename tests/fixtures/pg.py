"""Fixtures for working with the Postgres testing instance."""

import orjson
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from virtool.api.custom_json import dump_string
from virtool.pg.utils import Base, PgOptions, get_sqlalchemy_url


@pytest.fixture(scope="session")
def pg_base_connection_string(request, pg_db_name: str) -> str:
    """A Postgres connection string without the database name at the end.

    This is used to manage databases in the Postgres instance. It is used by
    migration-specific fixtures like :func:`migration_pg` to create and drop databases.

    eg. ``postgresql://virtool:virtool@localhost``

    """
    return "postgresql://virtool:virtool@postgres:5432"


@pytest.fixture(scope="session")
def pg_base_options(pg_base_connection_string: str) -> PgOptions:
    """A Postgres connection string without the database name at the end.

    This is used to manage databases in the Postgres instance. It is used by
    migration-specific fixtures like :func:`migration_pg` to create and drop databases.

    eg. ``postgresql://virtool:virtool@localhost``

    """
    return PgOptions.from_connection_string(
        "postgresql://virtool:virtool@postgres:5432"
    )


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

     eg. postgresql://virtool:virtool@localhost/test_2

    """
    return f"{pg_base_connection_string}/{pg_db_name}"


@pytest.fixture(scope="session")
def postgres_options(pg_connection_string: str) -> PgOptions:
    """PgOptions adaptor object for ensuring compatiblity with SQLAlchemy and asyncpg"""
    return PgOptions.from_connection_string(pg_connection_string)


@pytest.fixture(scope="session")
async def engine(
    pg_db_name: str,
    pg_base_options: PgOptions,
    postgres_options: PgOptions,
) -> AsyncEngine:
    """Return a SQLAlchemy :class:`AsyncEngine` object for an auto-generated test database.

    Test database are specific to xdist workers.

    """
    engine_without_db = create_async_engine(
        get_sqlalchemy_url(pg_base_options),
        isolation_level="AUTOCOMMIT",
    )

    async with engine_without_db.connect() as conn:
        # Terminate all connections to the database before dropping it
        await conn.execute(
            text(
                f"""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = '{pg_db_name}' AND pid <> pg_backend_pid();
                """,
            ),
        )
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

    await engine_without_db.dispose()

    engine = create_async_engine(
        get_sqlalchemy_url(postgres_options),
        echo=False,
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.commit()

    yield engine

    await engine.dispose()

    # Force close all connections to the database before dropping it
    engine_without_db = create_async_engine(
        get_sqlalchemy_url(pg_base_options),
        isolation_level="AUTOCOMMIT",
    )

    async with engine_without_db.connect() as conn:
        # Terminate all other connections to the database
        await conn.execute(
            text(
                f"""
                SELECT pg_terminate_backend(pid)
                FROM pg_stat_activity
                WHERE datname = '{pg_db_name}' AND pid <> pg_backend_pid();
                """,
            ),
        )
        await conn.execute(
            text(
                f"DROP DATABASE IF EXISTS {pg_db_name};",
            ),
        )

    await engine_without_db.dispose()


@pytest.fixture
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
