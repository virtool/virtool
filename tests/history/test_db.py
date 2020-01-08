import datetime
from aiohttp.test_utils import make_mocked_coro

import pytest

import virtool.history.db


class TestAdd:

    async def test(self, dbi, static_time, test_otu_edit, test_change):
        app = {
            "db": dbi,
            "settings": {
                "data_path": "/foo/bar"
            }
        }

        old, new = test_otu_edit

        returned_change = await virtool.history.db.add(
            app,
            "edit",
            old,
            new,
            "Edited {}".format(new["name"]),
            "test"
        )

        document = await dbi.history.find_one()

        # Sort the real and expected diffs so they are directly comparable.
        returned_change["diff"].sort()
        document["diff"].sort()
        test_change["diff"].sort()

        assert document == test_change

        assert returned_change == {
            "_id": "6116cba1.1",
            "description": "Edited Prunus virus E",
            "diff": [
                ("change", "abbreviation", ("PVF", "")),
                ("change", "name", ("Prunus virus F", "Prunus virus E")),
                ("change", "version", (0, 1))
            ],
            "index": {
                "id": "unbuilt",
                "version": "unbuilt"
            },
            "method_name": "edit",
            "created_at": static_time.datetime,
            "user": {
                "id": "test"
            },
            "reference": {
                "id": "hxn167"
            },
            "otu": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": 1
            }
        }

    async def test_create(self, dbi, static_time, test_otu_edit, test_change):
        app = {
            "db": dbi,
            "settings": {
                "data_path": "/foo/bar"
            }
        }

        # There is no old document because this is a change document for a otu creation operation.
        old = None

        new, _ = test_otu_edit

        description = "Created {}".format(new["name"])

        returned_change = await virtool.history.db.add(
            app,
            "create",
            old,
            new,
            description,
            "test"
        )

        document = await dbi.history.find_one()

        # Update the base test_change document to verify the real added change document.
        test_change.update({
            "_id": "6116cba1.0",
            "otu": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": 0
            },
            "description": description,
            "diff": new,
            "method_name": "create"
        })

        assert document == test_change

        test_change.update({
            "description": test_change["description"],
            "created_at": static_time.datetime
        })

        assert returned_change == test_change

    async def test_remove(self, dbi, static_time, test_otu_edit, test_change):
        """
        Test that the addition of a change due to otu removal inserts the expected change document.

        """
        app = {
            "db": dbi,
            "settings": {
                "data_path": "/foo/bar"
            }
        }

        # There is no new document because this is a change document for a otu removal operation.
        new = None

        old, _ = test_otu_edit

        description = "Removed {}".format(old["name"])

        returned_change = await virtool.history.db.add(
            app,
            "remove",
            old,
            new,
            description,
            "test"
        )

        document = await dbi.history.find_one()

        # Update the base test_change document to verify the real added change document.
        test_change.update({
            "_id": "6116cba1.removed",
            "otu": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": "removed"
            },
            "description": description,
            "diff": old,
            "method_name": "remove"
        })

        assert document == test_change

        test_change.update({
            "description": test_change["description"],
            "created_at": static_time.datetime
        })

        assert returned_change == test_change


@pytest.mark.parametrize("file", [True, False])
async def test_get(file, mocker, snapshot, dbi):
    await dbi.history.insert_one({
        "_id": "baz.2",
        "diff": "file" if file else {
            "foo": "bar"
        }
    })

    m = mocker.patch("virtool.history.utils.read_diff_file", make_mocked_coro(return_value="loaded"))

    app = {
        "db": dbi,
        "settings": {
            "data_path": "/foo/bar"
        }
    }

    document = await virtool.history.db.get(app, "baz.2")

    assert document == {
        "id": "baz.2",
        "diff": "loaded" if file else {
            "foo": "bar"
        }
    }



@pytest.mark.parametrize("exists", [True, False])
async def test_get_most_recent_change(exists, dbi, static_time):
    """
    Test that the most recent change document is returned for the given ``otu_id``.

    """
    # First change is 3 days before the second
    delta = datetime.timedelta(3)

    if exists:
        await dbi.history.insert_many([
            {
                "_id": "6116cba1.1",
                "description": "Description",
                "method_name": "update",
                "created_at": static_time.datetime - delta,
                "user": {
                    "id": "test"
                },
                "otu": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 1
                },
                "index": {
                    "id": "unbuilt"
                }
            },
            {
                "_id": "6116cba1.2",
                "description": "Description number 2",
                "method_name": "update",
                "created_at": static_time.datetime,
                "user": {
                    "id": "test"
                },
                "otu": {
                    "id": "6116cba1",
                    "name": "Prunus virus F",
                    "version": 2
                },
                "index": {
                    "id": "unbuilt"
                }
            }
        ])

    most_recent = await virtool.history.db.get_most_recent_change(dbi, "6116cba1")

    if exists:
        assert most_recent == {
            "_id": "6116cba1.2",
            "description": "Description number 2",
            "method_name": "update",
            "created_at": static_time.datetime,
            "user": {
                "id": "test"
            },
            "otu": {
                "id": "6116cba1",
                "name": "Prunus virus F",
                "version": 2
            }
        }
    else:
        assert most_recent is None


@pytest.mark.parametrize("remove", [True, False])
async def test_patch_to_version(remove, snapshot, dbi, test_merged_otu, create_mock_history):
    app = {
        "db": dbi
    }

    expected_current = await create_mock_history(remove)

    current, patched, reverted_change_ids = await virtool.history.db.patch_to_version(
        app,
        "6116cba1",
        1
    )

    snapshot.assert_match(current)
    snapshot.assert_match(patched)
    snapshot.assert_match(reverted_change_ids)
