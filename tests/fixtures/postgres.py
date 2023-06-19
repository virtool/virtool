import asyncio

import orjson
import pytest
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from virtool.api.custom_json import dump_string
from virtool.pg.utils import Base


@pytest.fixture(scope="session")
def pg_base_connection_string(request, pg_db_name: str):
    """
    A Postgres connection string without the database name at the end.

    eg. postgresql+asyncpg://virtool:virtool@localhost

    """
    return request.config.getoption("postgres_connection_string")


@pytest.fixture(scope="session")
def pg_db_name(worker_id: str):
    """
    An auto-generated Postgres database name. One database is generated for each xdist worker.

    eg. test_2 (for worker-2)

    """
    return f"test_{worker_id}"


@pytest.fixture(scope="session")
def pg_connection_string(pg_base_connection_string: str, pg_db_name: str):
    """
    A full Postgres connection string with the auto-generated test database name appended.

     eg. postgresql+asyncpg://virtool:virtool@localhost/test_2

    """
    return f"{pg_base_connection_string}/{pg_db_name}"


@pytest.fixture(scope="session")
def loop():
    """Overrides pytest default function scoped event loop"""
    policy = asyncio.get_event_loop_policy()
    loop = policy.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def engine(
    loop, pg_db_name: str, pg_base_connection_string: str, pg_connection_string: str
) -> AsyncEngine:
    """
    Return a SQLAlchemy :class:`AsyncEngine` object for an auto-generated test database.

    Test database are specific to xdist workers.

    """
    engine = create_async_engine(
        pg_base_connection_string,
        isolation_level="AUTOCOMMIT",
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
        pool_recycle=1800,
    )

    async with engine.connect() as conn:
        try:
            await conn.execute(text(f"CREATE DATABASE {pg_db_name}"))
        except ProgrammingError as exc:
            if "DuplicateDatabaseError" not in str(exc):
                raise

    await engine.dispose()

    pg = create_async_engine(
        pg_connection_string,
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
        pool_recycle=1800,
    )

    async with pg.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.commit()

    return pg


@pytest.fixture(scope="function")
async def pg(loop, engine: AsyncEngine):
    async with AsyncSession(engine) as session:
        await session.execute(
            text(
                """TRUNCATE TABLE analysis_files,
                                labels,
                                sample_artifacts,
                                subtraction_files,
                                sample_artifacts_cache,
                                sample_reads_cache,
                                index_files,
                                instance_messages,
                                uploads,
                                nuvs_blast,
                                sample_reads,
                                revisions,
                                tasks RESTART IDENTITY"""
            )
        )
        await session.commit()

    # This is necessary to prevent InvalidCachedStatementError exceptions in some tests.
    await engine.dispose()

    yield engine
