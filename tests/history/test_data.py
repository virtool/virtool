import asyncio

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

from virtool.fake.next import DataFaker
from virtool.history.data import HistoryData
from virtool.history.db import bulk_insert_diffs
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
