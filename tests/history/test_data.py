import asyncio
from pathlib import Path

import pytest
from aiohttp.test_utils import make_mocked_coro
from syrupy import SnapshotAssertion

from virtool.fake.next import DataFaker
from virtool.history.data import HistoryData
from virtool.mongo.core import Mongo


@pytest.mark.parametrize("file", [True, False])
async def test_get(
    data_path: Path,
    file,
    fake2: DataFaker,
    mocker,
    mongo: Mongo,
    snapshot: SnapshotAssertion,
    static_time,
):
    user = await fake2.users.create()

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
        make_mocked_coro(return_value="loaded"),
    )

    history = HistoryData(data_path, mongo)

    assert await history.get("baz.2") == snapshot
