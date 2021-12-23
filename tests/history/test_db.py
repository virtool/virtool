import datetime

import pytest
import virtool.history.db
from aiohttp.test_utils import make_mocked_coro


class TestAdd:
    async def test(
        self, snapshot, dbi, static_time, test_otu_edit, test_change, tmp_path, config
    ):

        app = {"db": dbi, "config": config}

        old, new = test_otu_edit

        change = await virtool.history.db.add(
            app, "edit", old, new, "Edited {}".format(new["name"]), "test"
        )

        assert change == snapshot
        assert await dbi.history.find_one() == snapshot

    async def test_create(
        self, snapshot, dbi, static_time, test_otu_edit, test_change, tmp_path, config
    ):
        app = {"db": dbi, "config": config}

        # There is no old document because this is a change document for a otu creation operation.
        old = None

        new, _ = test_otu_edit

        description = "Created {}".format(new["name"])

        change = await virtool.history.db.add(
            app, "create", old, new, description, "test"
        )

        assert change == snapshot
        assert await dbi.history.find_one() == snapshot

    async def test_remove(
        self, snapshot, dbi, static_time, test_otu_edit, test_change, tmp_path, config
    ):
        """
        Test that the addition of a change due to otu removal inserts the expected change document.

        """
        app = {"db": dbi, "config": config}

        # There is no new document because this is a change document for a otu removal operation.
        new = None

        old, _ = test_otu_edit

        description = "Removed {}".format(old["name"])

        change = await virtool.history.db.add(
            app, "remove", old, new, description, "test"
        )

        assert change == snapshot
        assert await dbi.history.find_one() == snapshot


@pytest.mark.parametrize("file", [True, False])
async def test_get(file, mocker, snapshot, dbi, fake, tmp_path, config):
    user = await fake.users.insert()

    await dbi.history.insert_one(
        {
            "_id": "baz.2",
            "diff": "file" if file else {"foo": "bar"},
            "user": {"id": user["_id"]},
        }
    )

    mocker.patch(
        "virtool.history.utils.read_diff_file", make_mocked_coro(return_value="loaded")
    )

    app = {"db": dbi, "config": config}

    assert await virtool.history.db.get(app, "baz.2") == snapshot


@pytest.mark.parametrize("exists", [True, False])
async def test_get_most_recent_change(exists, snapshot, dbi, static_time):
    """
    Test that the most recent change document is returned for the given ``otu_id``.

    """
    # First change is 3 days before the second
    delta = datetime.timedelta(3)

    if exists:
        await dbi.history.insert_many(
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

    return_value = await virtool.history.db.get_most_recent_change(dbi, "6116cba1")
    assert return_value == snapshot


@pytest.mark.parametrize("remove", [True, False])
async def test_patch_to_version(remove, snapshot, dbi, create_mock_history):
    await create_mock_history(remove=remove)

    app = {"db": dbi}

    current, patched, reverted_change_ids = await virtool.history.db.patch_to_version(
        app, "6116cba1", 1
    )

    assert current == snapshot
    assert patched == snapshot
    assert reverted_change_ids == snapshot
