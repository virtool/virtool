import datetime

import pytest
import virtool.history.db
from virtool.history.data import HistoryData
from aiohttp.test_utils import make_mocked_coro
from virtool_core.models.enums import HistoryMethod


class TestAdd:
    async def test(
        self, snapshot, mongo, static_time, test_otu_edit, test_change, tmp_path, config
    ):

        app = {"db": mongo, "config": config}

        old, new = test_otu_edit

        change = await virtool.history.db.add(
            mongo, config, HistoryMethod.edit, old, new, f"Edited {new['name']}", "test"
        )

        assert change == snapshot
        assert await mongo.history.find_one() == snapshot

    async def test_create(
        self, snapshot, mongo, static_time, test_otu_edit, test_change, tmp_path, config
    ):
        app = {"db": mongo, "config": config}

        # There is no old document because this is a change document for a otu creation operation.
        old = None

        new, _ = test_otu_edit

        description = f"Created {new['name']}"

        change = await virtool.history.db.add(
            mongo, config, HistoryMethod.create, old, new, description, "test"
        )

        assert change == snapshot
        assert await mongo.history.find_one() == snapshot

    async def test_remove(
        self, snapshot, mongo, static_time, test_otu_edit, test_change, tmp_path, config
    ):
        """
        Test that the addition of a change due to otu removal inserts the expected change document.

        """
        app = {"db": mongo, "config": config}

        # There is no new document because this is a change document for a otu removal operation.
        new = None

        old, _ = test_otu_edit

        description = f"Removed {old['name']}"

        change = await virtool.history.db.add(
            mongo, config, HistoryMethod.remove, old, new, description, "test"
        )

        assert change == snapshot
        assert await mongo.history.find_one() == snapshot


@pytest.mark.parametrize("file", [True, False])
async def test_get(file, mocker, snapshot, mongo, fake2, tmp_path, config):
    user = await fake2.users.create()

    await mongo.history.insert_one(
        {
            "_id": "baz.2",
            "diff": "file" if file else {"foo": "bar"},
            "user": {"id": user.id},
        }
    )

    mocker.patch(
        "virtool.history.utils.read_diff_file", make_mocked_coro(return_value="loaded")
    )

    app = {"db": mongo, "config": config}

    history = HistoryData(app["config"].data_path, mongo)

    assert await history.get("baz.2") == snapshot


@pytest.mark.parametrize("exists", [True, False])
async def test_get_most_recent_change(exists, snapshot, mongo, static_time):
    """
    Test that the most recent change document is returned for the given ``otu_id``.

    """
    # First change is 3 days before the second
    delta = datetime.timedelta(3)

    if exists:
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
            ]
        )

    return_value = await virtool.history.db.get_most_recent_change(mongo, "6116cba1")
    assert return_value == snapshot


@pytest.mark.parametrize("remove", [True, False])
async def test_patch_to_version(remove, snapshot, config, mongo, create_mock_history):
    await create_mock_history(remove=remove)

    current, patched, reverted_change_ids = await virtool.history.db.patch_to_version(
        config.data_path, mongo, "6116cba1", 1
    )

    assert current == snapshot
    assert patched == snapshot
    assert reverted_change_ids == snapshot
