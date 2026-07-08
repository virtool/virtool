import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import both_transactions, compose_legacy_id_multi_mongo_match
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id
from virtool.users.utils import generate_base_permissions


class TestComposeLegacyIdMultiMongoMatch:
    @pytest.fixture
    async def groups(self, pg: AsyncEngine) -> dict[str, int]:
        async with AsyncSession(pg) as session:
            rows = [
                SQLGroup(
                    legacy_id="group_a_legacy",
                    name="A",
                    permissions=generate_base_permissions(),
                ),
                SQLGroup(
                    legacy_id="group_b_legacy",
                    name="B",
                    permissions=generate_base_permissions(),
                ),
            ]
            session.add_all(rows)
            await session.flush()
            ids = {row.legacy_id: row.id for row in rows}
            await session.commit()

        return ids

    async def test_covers_both_forms(self, pg: AsyncEngine, groups: dict[str, int]):
        """Each matched row contributes both its legacy string and integer id."""
        match = await compose_legacy_id_multi_mongo_match(
            pg, SQLGroup, ["group_a_legacy", "group_b_legacy"]
        )

        assert set(match["$in"]) == {
            "group_a_legacy",
            "group_b_legacy",
            groups["group_a_legacy"],
            groups["group_b_legacy"],
        }

    async def test_integer_input_resolves_legacy(
        self, pg: AsyncEngine, groups: dict[str, int]
    ):
        """An integer input resolves to its legacy string so mixed-form documents
        still match.
        """
        match = await compose_legacy_id_multi_mongo_match(
            pg, SQLGroup, [groups["group_a_legacy"]]
        )

        assert set(match["$in"]) == {groups["group_a_legacy"], "group_a_legacy"}

    async def test_unresolved_id_passes_through(
        self, pg: AsyncEngine, groups: dict[str, int]
    ):
        """An id with no matching row is kept so nothing is silently dropped."""
        match = await compose_legacy_id_multi_mongo_match(
            pg, SQLGroup, ["group_a_legacy", "ghost"]
        )

        assert "ghost" in match["$in"]
        assert groups["group_a_legacy"] in match["$in"]

    async def test_empty_matches_nothing(self, pg: AsyncEngine):
        """An empty id list yields an empty ``$in`` without querying Postgres."""
        assert await compose_legacy_id_multi_mongo_match(pg, SQLGroup, []) == {
            "$in": []
        }


class TestBothTransactions:
    async def test_mongo_only(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        """Test that a change to the MongoDB database is committed if no change is made
        to the PostgreSQL database.
        """
        async with both_transactions(mongo, pg) as (mongo_session, _):
            await mongo.samples.insert_one({"_id": "test"}, session=mongo_session)

        assert await mongo.samples.find_one({}) == snapshot
        assert await get_row_by_id(pg, SQLGroup, 1) is None

    async def test_pg_only(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        """Test that a change to the PostgreSQL database is committed if no change is made
        to the MongoDB database.
        """
        async with both_transactions(mongo, pg) as (_, pg_session):
            pg_session.add(
                SQLGroup(name="test", permissions=generate_base_permissions())
            )

        assert await mongo.samples.count_documents({}) == 0
        assert await get_row_by_id(pg, SQLGroup, 1) == snapshot

    async def test_both(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        """Test that changes to both databases are successful."""
        async with both_transactions(mongo, pg) as (mongo_session, pg_session):
            await mongo.samples.insert_one({"_id": "test"}, session=mongo_session)
            pg_session.add(
                SQLGroup(name="test", permissions=generate_base_permissions())
            )

        assert await mongo.samples.find_one({}) == snapshot(name="mongo")
        assert await get_row_by_id(pg, SQLGroup, 1) == snapshot(name="pg")

    async def test_mongo_exception(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        """Test that neither change is committed if an exception is raised within the
        context manager.
        """
        await mongo.samples.insert_one({"_id": "test"})

        with pytest.raises(Exception):
            async with both_transactions(mongo, pg) as (mongo_session, pg_session):
                await mongo.samples.insert_one({"_id": "test"}, session=mongo_session)
                pg_session.add(
                    SQLGroup(name="Test", permissions=generate_base_permissions())
                )

        assert await mongo.samples.count_documents({}) == 1
        assert await get_row_by_id(pg, SQLGroup, 1) is None

    async def test_pg_exception(self, mongo: Mongo, pg: AsyncEngine, snapshot):
        """Test that neither change is committed if a SQLAlchemy exception is raised within
        the context manager.
        """
        async with AsyncSession(pg) as session:
            session.add(SQLGroup(name="Test", permissions=generate_base_permissions()))
            await session.commit()

        with pytest.raises(Exception):
            async with both_transactions(mongo, pg) as (mongo_session, pg_session):
                await mongo.samples.insert_one({"_id": "test"}, session=mongo_session)
                pg_session.add(
                    SQLGroup(name="Test", permissions=generate_base_permissions())
                )

        assert await mongo.samples.count_documents({}) == 0
        assert await get_row_by_id(pg, SQLGroup, 1) == snapshot(name="pg")
