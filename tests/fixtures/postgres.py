import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine

from virtool.pg.testing import create_test_database
from virtool.pg.utils import Base


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
async def pg(
        loop,
        pg_db_name: str,
        pg_base_connection_string: str,
        pg_connection_string: str
) -> AsyncEngine:
    """
    Return a SQLAlchemy :class:`AsyncEngine` object for an auto-generated test database.

    Test database are specific to xdist workers.

    """
    await create_test_database(pg_base_connection_string, pg_db_name)

    pg = create_async_engine(pg_connection_string)

    async with pg.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await conn.commit()

    return pg


@pytest.fixture
async def pg_session(pg: AsyncEngine) -> AsyncSession:
    """
    Return an :class:`AsyncSession` object backed by a test database that can be used for testing
    calls to SQLAlchemy.

    Empties tables using `TRUNCATE` between tests.

    """
    session = AsyncSession(bind=pg)

    yield session

    async with pg.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await session.close()
