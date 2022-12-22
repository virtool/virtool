import datetime

import pytest
from virtool_core.models.enums import HistoryMethod

import virtool.history.db


class TestAdd:
    async def test(
        self, snapshot, mongo, static_time, test_otu_edit, test_change, tmp_path, config
    ):
        old, new = test_otu_edit

        change = await virtool.history.db.add(
            mongo,
            config.data_path,
            HistoryMethod.edit,
            old,
            new,
            f"Edited {new['name']}",
            "test",
        )

        assert change == snapshot
        assert await mongo.history.find_one() == snapshot

    async def test_create(
        self, snapshot, mongo, static_time, test_otu_edit, test_change, tmp_path, config
    ):
        # There is no old document because this is a change document for a otu creation
        # operation.
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
        # There is no new document because this is a change document for a otu removal operation.
        new = None

        old, _ = test_otu_edit

        description = f"Removed {old['name']}"

        change = await virtool.history.db.add(
            mongo, config, HistoryMethod.remove, old, new, description, "test"
        )

        assert change == snapshot
        assert await mongo.history.find_one() == snapshot


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
            ],
            session=None,
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
