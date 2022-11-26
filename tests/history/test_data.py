import asyncio

import pytest
from aiohttp.test_utils import make_mocked_coro

from virtool.history.data import HistoryData


@pytest.mark.parametrize("file", [True, False])
async def test_get(file, mocker, snapshot, mongo, fake2, tmp_path, config):
    user = await fake2.users.create()

    await asyncio.gather(
        mongo.references.insert_one(
            {"_id": "hxn167", "data_type": "genome", "name": "Reference A"}
        ),
        mongo.history.insert_one(
            {
                "_id": "baz.2",
                "diff": "file" if file else {"foo": "bar"},
                "user": {"id": user.id},
                "reference": {"id": "hxn167"},
            }
        ),
    )

    mocker.patch(
        "virtool.history.utils.read_diff_file", make_mocked_coro(return_value="loaded")
    )

    history = HistoryData(config.data_path, mongo)

    assert await history.get("baz.2") == snapshot
