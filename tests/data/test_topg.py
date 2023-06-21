import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import both_transactions
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.users.utils import generate_base_permissions


class TestBothTransactions:
    async def test_mongo_only(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        async with both_transactions(mongo, pg) as (mongo_session, pg_session):
            await mongo.groups.insert_one({"_id": "test"}, session=mongo_session)

        assert await mongo.groups.find_one({}) == snapshot
        assert await get_row_by_id(pg, SQLGroup, 1) is None

    async def test_pg_only(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        async with both_transactions(mongo, pg) as (mongo_session, pg_session):
            pg_session.add(
                SQLGroup(name="test", permissions=generate_base_permissions())
            )

        assert await mongo.groups.count_documents({}) == 0
        assert await get_row_by_id(pg, SQLGroup, 1) == snapshot

    async def test_both(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        async with both_transactions(mongo, pg) as (mongo_session, pg_session):
            await mongo.groups.insert_one({"_id": "test"}, session=mongo_session)
            pg_session.add(
                SQLGroup(name="test", permissions=generate_base_permissions())
            )

        assert await mongo.groups.find_one({}) == snapshot(name="mongo")
        assert await get_row_by_id(pg, SQLGroup, 1) == snapshot(name="pg")

    async def test_mongo_exception(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        """
        Test that neither change is committed if an exception is raised within the
        context manager.
        """
        await mongo.groups.insert_one({"_id": "test"})

        with pytest.raises(Exception) as excinfo:
            async with both_transactions(mongo, pg) as (mongo_session, pg_session):
                await mongo.groups.insert_one({"_id": "test"}, session=mongo_session)
                pg_session.add(
                    SQLGroup(name="Test", permissions=generate_base_permissions())
                )

        assert await mongo.groups.count_documents({}) == 1
        assert await get_row_by_id(pg, SQLGroup, 1) is None

    async def test_pg_exception(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        """
        Test that neither change is committed if an exception is raised within the
        context manager.
        """
        async with AsyncSession(pg) as session:
            session.add(SQLGroup(name="Test", permissions=generate_base_permissions()))
            await session.commit()

        with pytest.raises(Exception) as excinfo:
            async with both_transactions(mongo, pg) as (mongo_session, pg_session):
                await mongo.groups.insert_one({"_id": "test"}, session=mongo_session)
                pg_session.add(
                    SQLGroup(name="Test", permissions=generate_base_permissions())
                )

        assert await mongo.groups.count_documents({}) == 0
        assert await get_row_by_id(pg, SQLGroup, 1) == snapshot(name="pg")
