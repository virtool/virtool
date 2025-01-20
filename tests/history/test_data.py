import asyncio
from pathlib import Path

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion

from virtool.fake.next import DataFaker
from virtool.history.data import HistoryData
from virtool.mongo.core import Mongo


@pytest.mark.parametrize("file", [True, False])
async def test_get(
    data_path: Path,
    file,
    fake: DataFaker,
    mocker: MockerFixture,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time,
):
    user = await fake.users.create()

    await asyncio.gather(
        mongo.references.insert_one(
            {"_id": "hxn167", "data_type": "genome", "name": "Reference A"},
        ),
        mongo.history.insert_one(
            {
                "_id": "baz.2",
                "diff": "file" if file else {"foo": "bar"},
                "user": {"id": user.id},
                "reference": {"id": "hxn167"},
                "created_at": static_time.datetime,
                "description": "test history",
                "method_name": "create",
                "otu": {"id": "6116cba1", "name": "Prunus virus F", "version": 1},
            },
        ),
    )

    mocker.patch(
        "virtool.history.utils.read_diff_file",
        return_value="loaded",
    )

    assert await HistoryData(data_path, mongo, pg).get("baz.2") == snapshot
