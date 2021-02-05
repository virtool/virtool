import pytest
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

import virtool.api.json
from virtool.postgres import Base


@pytest.fixture
def pg_base_connection_string(request, pg_db_name):
    """
    A Postgres connection string without the database name at the end.

    eg. postgresql+asyncpg://virtool:virtool@localhost

    """
    return request.config.getoption("postgres_connection_string")


@pytest.fixture
def pg_db_name(worker_id):
    """
    An auto-generated Postgres database name. One database is generated for each xdist worker.

    eg. test_2 (for worker-2)

    """
    return f"test_{worker_id}"


@pytest.fixture
def pg_connection_string(pg_base_connection_string: str, pg_db_name: str):
    """
    A full Postgres connection string with the auto-generated test database name appended.

     eg. postgresql+asyncpg://virtool:virtool@localhost/test_2

    """
    return f"{pg_base_connection_string}/{pg_db_name}"


@pytest.fixture
async def pg_engine(
        pg_db_name: str,
        pg_base_connection_string: str,
        pg_connection_string: str
) -> AsyncEngine:
    """
    Return a SQLAlchemy :class:`AsyncEngine` object for an auto-generated test database.

    Test database are specific to xdist workers.

    """
    engine = create_async_engine(f"{pg_base_connection_string}", isolation_level="AUTOCOMMIT", json_serializer=virtool.api.json.dumps)

    async with engine.connect() as conn:
        try:
            await conn.execute(text(f"CREATE DATABASE {pg_db_name}"))
        except ProgrammingError as exc:
            if "DuplicateDatabaseError" not in str(exc):
                raise

    return create_async_engine(pg_connection_string)


@pytest.fixture
async def pg_session(pg_engine: AsyncEngine) -> AsyncSession:
    """
    Return an :class:`AsyncSession` object backed by a test database that can be used for testing
    calls to SQLAlchemy.

    Empties tables using `TRUNCATE` between tests.

    """
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

        await conn.execute(text("TRUNCATE labels"))
        await conn.execute(text("TRUNCATE tasks"))
    session = AsyncSession(bind=pg_engine)

    yield session

    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await session.close()
