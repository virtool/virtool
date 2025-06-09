import asyncio
import datetime
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

import virtool.history.db
from tests.fixtures.core import StaticTime
from virtool.history.sql import SQLHistoryDiff
from virtool.models.enums import HistoryMethod
from virtool.mongo.core import Mongo
from virtool.pg.utils import get_row_by_id


class TestAdd:
    async def test_edit(
        self,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
        test_otu_edit,
        test_change,
    ):
        old, new = test_otu_edit

        async with mongo.create_session() as session:
            change = await virtool.history.db.add(
                mongo,
                pg,
                "This is a description",
                HistoryMethod.edit,
                old,
                new,
                "test",
                session,
            )

        change_id = change["_id"]

        assert change == snapshot
        assert await mongo.history.find_one(change_id) == snapshot

        async with AsyncSession(pg) as session:
            result = await session.execute(
                select(SQLHistoryDiff.diff).where(
                    SQLHistoryDiff.change_id == change_id,
                ),
            )

            assert result.scalar_one_or_none() == snapshot

    async def test_create(
        self,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
        test_otu_edit,
        test_change,
    ):
        # There is no old document because this is a change document for an otu creation
        # operation.
        old = None

        new, _ = test_otu_edit

        change = await virtool.history.db.add(
            mongo,
            pg,
            f"Created {new['name']}",
            HistoryMethod.create,
            old,
            new,
            "test",
        )

        assert change == snapshot
        assert await mongo.history.find_one() == snapshot
        assert await get_row_by_id(pg, SQLHistoryDiff, 1) == snapshot

    async def test_remove(
        self,
        config,
        mongo: Mongo,
        pg: AsyncEngine,
        snapshot: SnapshotAssertion,
        static_time,
        test_otu_edit,
        test_change,
        tmp_path,
    ):
        """Test that the addition of a change due to otu removal inserts the expected change document."""
        # There is no new document because this is a change document for a otu removal operation.
        new = None

        old, _ = test_otu_edit

        change = await virtool.history.db.add(
            mongo,
            pg,
            f"Removed {old['name']}",
            HistoryMethod.remove,
            old,
            new,
            "test",
        )

        assert change == snapshot(name="return_value")

        diff, document = await asyncio.gather(
            get_row_by_id(pg, SQLHistoryDiff, 1),
            mongo.history.find_one(),
        )

        assert diff == snapshot(name="diff")
        assert document == snapshot(name="document")


class TestGetMostRecentChange:
    async def test_ok(
        self,
        mongo: Mongo,
        snapshot: SnapshotAssertion,
        static_time: StaticTime,
    ):
        """Test that the most recent change document for the given otu is returned."""
        delta = datetime.timedelta(3)

        await mongo.history.insert_many(
            [
                {
                    "_id": "6116cba1.1",
                    "description": "Description",
                    "method_name": "update",
                    "created_at": static_time.datetime - delta,
                    "user": {"id": "test"},
                    "otu": {"id": "6116cba1", "name": "Prunus virus F", "version": 1},
                    "index": {"id": "unbuilt"},
                },
                {
                    "_id": "6116cba1.2",
                    "description": "Description number 2",
                    "method_name": "update",
                    "created_at": static_time.datetime,
                    "user": {"id": "test"},
                    "otu": {"id": "6116cba1", "name": "Prunus virus F", "version": 2},
                    "index": {"id": "unbuilt"},
                },
            ],
            session=None,
        )

        return_value = await virtool.history.db.get_most_recent_change(
            mongo,
            "6116cba1",
        )
        assert return_value == snapshot

    async def test_does_not_exist(self, mongo: Mongo):
        """Test that `None` is returned when no change document exists for the given
        otu.
        """
        assert (
            await virtool.history.db.get_most_recent_change(
                mongo,
                "6116cba1",
            )
            is None
        )


@pytest.mark.parametrize("remove", [True, False])
async def test_patch_to_version(
    remove: bool,
    create_mock_history,
    data_path: Path,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
):
    await create_mock_history(remove=remove)

    current, patched, reverted_change_ids = await virtool.history.db.patch_to_version(
        data_path,
        mongo,
        "6116cba1",
        1,
    )

    assert current == snapshot(name="current")
    assert patched == snapshot(name="patched")
    assert reverted_change_ids == snapshot(name="reverted_change_ids")
