import asyncio
import datetime

import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.errors import ResourceConflictError
from virtool.fake.next import DataFaker
from virtool.history.data import HistoryData
from virtool.history.db import bulk_insert_diffs
from virtool.history.sql import SQLHistoryDiff, SQLLegacyHistory
from virtool.mongo.core import Mongo


async def test_get(
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    user = await fake.users.create()

    await bulk_insert_diffs(
        pg,
        [
            {
                "change_id": "6116cba1.1",
                "diff": [["change", "abbreviation", ["PVF", "TST"]]],
            },
        ],
    )

    await asyncio.gather(
        mongo.references.insert_one(
            {
                "_id": "hxn167",
                "archived": False,
                "data_type": "genome",
                "name": "Reference A",
            },
        ),
        mongo.history.insert_one(
            {
                "_id": "6116cba1.1",
                "diff": "postgres",
                "user": {"id": user.id},
                "reference": {"id": "hxn167"},
                "created_at": static_time.datetime,
                "description": "test history",
                "method_name": "create",
                "otu": {"id": "6116cba1", "name": "Prunus virus F", "version": 1},
            },
        ),
    )

    assert await HistoryData(mongo, pg).get("6116cba1.1") == snapshot


async def test_get_inline_diff_raises(
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    static_time,
):
    """A change holding an unbackfilled inline diff raises instead of returning it."""
    user = await fake.users.create()

    await asyncio.gather(
        mongo.references.insert_one(
            {
                "_id": "hxn167",
                "archived": False,
                "data_type": "genome",
                "name": "Reference A",
            },
        ),
        mongo.history.insert_one(
            {
                "_id": "6116cba1.1",
                "diff": [["change", "abbreviation", ["PVF", "TST"]]],
                "user": {"id": user.id},
                "reference": {"id": "hxn167"},
                "created_at": static_time.datetime,
                "description": "test history",
                "method_name": "create",
                "otu": {"id": "6116cba1", "name": "Prunus virus F", "version": 1},
            },
        ),
    )

    with pytest.raises(
        ValueError, match="Unexpected inline diff for change 6116cba1.1"
    ):
        await HistoryData(mongo, pg).get("6116cba1.1")


MOCK_HISTORY_CHANGE_IDS = ["6116cba1.0", "6116cba1.1", "6116cba1.2", "6116cba1.3"]


async def seed_legacy_history(pg: AsyncEngine, user_id: int) -> None:
    """Mirror ``create_mock_history`` into the ``legacy_history`` table."""
    async with AsyncSession(pg) as session:
        for change_id in MOCK_HISTORY_CHANGE_IDS:
            otu_id, otu_version = change_id.split(".")
            session.add(
                SQLLegacyHistory(
                    legacy_id=change_id,
                    created_at=datetime.datetime(2017, 7, 12, 16, 0, 50),
                    description="Description",
                    method_name="update",
                    user_id=user_id,
                    otu=otu_id,
                    otu_name="Prunus virus F",
                    otu_version=otu_version,
                    reference="hxn167",
                    index="unbuilt",
                    index_version="unbuilt",
                ),
            )

        await session.commit()


async def legacy_history_ids(pg: AsyncEngine) -> list[str]:
    async with AsyncSession(pg) as session:
        return list(
            (
                await session.execute(
                    select(SQLLegacyHistory.legacy_id).order_by(
                        SQLLegacyHistory.legacy_id,
                    ),
                )
            )
            .scalars()
            .all(),
        )


async def history_diff_ids(pg: AsyncEngine) -> list[str]:
    async with AsyncSession(pg) as session:
        return list(
            (
                await session.execute(
                    select(SQLHistoryDiff.change_id).order_by(
                        SQLHistoryDiff.change_id,
                    ),
                )
            )
            .scalars()
            .all(),
        )


class TestDelete:
    async def test_dual_write(
        self,
        create_mock_history,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Reverting a change deletes the reverted rows from Mongo, ``legacy_history``
        and ``history_diffs`` together.
        """
        user = await fake.users.create()
        await create_mock_history(False)
        await seed_legacy_history(pg, user.id)

        await HistoryData(mongo, pg).delete("6116cba1.2")

        remaining = [
            change["_id"] for change in await mongo.history.find().to_list(None)
        ]
        assert sorted(remaining) == ["6116cba1.0", "6116cba1.1"]

        assert await legacy_history_ids(pg) == ["6116cba1.0", "6116cba1.1"]
        assert await history_diff_ids(pg) == ["6116cba1.0", "6116cba1.1"]

    async def test_rollback_preserves_postgres(
        self,
        create_mock_history,
        fake: DataFaker,
        mocker: MockerFixture,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """A failure mid-delete rolls back both stores, leaving every row intact."""
        user = await fake.users.create()
        await create_mock_history(False)
        await seed_legacy_history(pg, user.id)

        mocker.patch(
            "virtool.history.data.delete_history",
            side_effect=RuntimeError("boom"),
        )

        with pytest.raises(RuntimeError, match="boom"):
            await HistoryData(mongo, pg).delete("6116cba1.2")

        remaining = [
            change["_id"] for change in await mongo.history.find().to_list(None)
        ]
        assert sorted(remaining) == MOCK_HISTORY_CHANGE_IDS

        assert await legacy_history_ids(pg) == MOCK_HISTORY_CHANGE_IDS
        assert await history_diff_ids(pg) == MOCK_HISTORY_CHANGE_IDS

    async def test_conflict_when_built(
        self,
        fake: DataFaker,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """A change included in a build is not revertible."""
        user = await fake.users.create()

        await mongo.history.insert_one(
            {
                "_id": "6116cba1.1",
                "index": {"id": "index_1", "version": 2},
                "reference": {"id": "hxn167"},
                "user": {"id": user.id},
                "otu": {"id": "6116cba1", "name": "Prunus virus F", "version": 1},
            },
        )

        with pytest.raises(ResourceConflictError):
            await HistoryData(mongo, pg).delete("6116cba1.1")
