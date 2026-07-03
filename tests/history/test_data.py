import pytest
from pytest_mock import MockerFixture
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.fake.next import DataFaker
from virtool.history.data import HistoryData
from virtool.history.db import bulk_insert_diffs
from virtool.history.sql import SQLLegacyHistory, SQLLegacyHistoryDiff
from virtool.mongo.core import Mongo


async def test_get(
    fake: DataFaker,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    """A change is read from ``legacy_history`` with its diff and reference attached."""
    user = await fake.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SQLLegacyHistory(
                legacy_id="6116cba1.1",
                created_at=static_time.datetime,
                description="test history",
                method_name="create",
                user_id=user.id,
                otu="6116cba1",
                otu_name="Prunus virus F",
                otu_version="1",
                reference="hxn167",
                index=None,
                index_version=None,
            ),
        )

        await session.commit()

    await bulk_insert_diffs(
        pg,
        [
            {
                "change_id": "6116cba1.1",
                "diff": [["change", "abbreviation", ["PVF", "TST"]]],
            },
        ],
    )

    await mongo.references.insert_one(
        {
            "_id": "hxn167",
            "archived": False,
            "data_type": "genome",
            "name": "Reference A",
        },
    )

    assert await HistoryData(mongo, pg).get("6116cba1.1") == snapshot


async def test_get_not_found(mongo: Mongo, pg: AsyncEngine):
    """A change id with no ``legacy_history`` row raises ``ResourceNotFoundError``."""
    with pytest.raises(ResourceNotFoundError):
        await HistoryData(mongo, pg).get("6116cba1.1")


MOCK_HISTORY_CHANGE_IDS = ["6116cba1.0", "6116cba1.1", "6116cba1.2", "6116cba1.3"]


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
                    select(SQLLegacyHistoryDiff.change_id).order_by(
                        SQLLegacyHistoryDiff.change_id,
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
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """Reverting a change deletes the reverted rows from Mongo, ``legacy_history``
        and ``legacy_history_diff`` together.
        """
        await create_mock_history(False)

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
        mocker: MockerFixture,
        mongo: Mongo,
        pg: AsyncEngine,
    ):
        """A failure mid-delete rolls back both stores, leaving every row intact."""
        await create_mock_history(False)

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
        static_time,
    ):
        """A change included in a build is not revertible."""
        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            session.add(
                SQLLegacyHistory(
                    legacy_id="6116cba1.1",
                    created_at=static_time.datetime,
                    description="Edited Prunus virus F",
                    method_name="edit",
                    user_id=user.id,
                    otu="6116cba1",
                    otu_name="Prunus virus F",
                    otu_version="1",
                    reference="hxn167",
                    index="index_1",
                    index_version="2",
                ),
            )
            await session.commit()

        with pytest.raises(ResourceConflictError):
            await HistoryData(mongo, pg).delete("6116cba1.1")
