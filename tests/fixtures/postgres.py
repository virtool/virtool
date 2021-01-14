import pytest

from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.models import Base


@pytest.fixture
def test_pg_connection_string(request):
    return request.config.getoption("postgres_connection_string")


@pytest.fixture(scope="function")
async def pg_engine(test_pg_connection_string):
    engine = create_async_engine("postgresql+asyncpg://virtool:virtool@localhost/virtool", isolation_level="AUTOCOMMIT")
    async with engine.connect() as conn:
        try:
            await conn.execute(text("CREATE DATABASE test"))
        except ProgrammingError:
            pass
    return create_async_engine(test_pg_connection_string)


@pytest.fixture(scope="function")
async def test_session(pg_engine, loop):
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session = AsyncSession(bind=pg_engine)
    yield session
    async with pg_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await session.close()
