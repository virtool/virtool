import pytest

import virtool.otus.isolates


@pytest.mark.parametrize("default", [True, False])
@pytest.mark.parametrize("empty", [True, False], ids=["empty", "not_empty"])
@pytest.mark.parametrize("existing_default", [True, False])
@pytest.mark.parametrize("isolate_id", [None, "isolate"])
async def test_add(
        default,
        empty,
        existing_default,
        isolate_id,
        dbi,
        snapshot,
        test_otu,
        static_time,
        test_random_alphanumeric
):
    """
    Test that adding an isolate works correctly. Parametrize to make sure that setting the default isolate works
    correctly in all cases

    """
    app = {
        "db": dbi,
        "settings": {
            "data_path": "/foo"
        }
    }

    test_otu["isolates"][0]["default"] = existing_default

    if empty:
        test_otu["isolates"] = []

    await dbi.otus.insert_one(test_otu)

    return_value = await virtool.otus.isolates.add(
        app,
        "6116cba1",
        {
            "source_type": "isolate",
            "source_name": "B",
            "default": default
        },
        "bob",
        isolate_id=isolate_id
    )

    snapshot.assert_match(await dbi.otus.find_one(), "otu")
    snapshot.assert_match(await dbi.history.find_one(), "history")
    snapshot.assert_match(return_value, "return_value")


async def test_edit(dbi, snapshot, test_otu, static_time):
    app = {
        "db": dbi,
        "settings": {
            "data_path": "/foo"
        }
    }

    await dbi.otus.insert_one(test_otu)

    await virtool.otus.isolates.edit(
        app,
        "6116cba1",
        "cab8b360",
        {
            "source_type": "strain",
            "source_name": "0"
        },
        "bob"
    )

    snapshot.assert_match(await dbi.otus.find_one(), "otu")
    snapshot.assert_match(await dbi.history.find_one(), "history")


@pytest.mark.parametrize("isolate_id", ["cab8b360", "bar"])
async def test_remove(isolate_id, dbi, snapshot, test_otu, test_sequence, static_time):
    """
    Test removing an isolate. Make sure the default isolate is reassigned if the default isolate is removed.

    """
    app = {
        "db": dbi,
        "settings": {
            "data_path": "/foo"
        }
    }

    test_otu["isolates"].append({
        "default": False,
        "id": "bar",
        "source_type": "isolate",
        "source_name": "A"
    })

    await dbi.otus.insert_one(test_otu)
    await dbi.sequences.insert_one(test_sequence)

    await virtool.otus.isolates.remove(
        app,
        "6116cba1",
        isolate_id,
        "bob"
    )

    snapshot.assert_match(await dbi.otus.find_one(), "otu")
    snapshot.assert_match(await dbi.history.find_one(), "history")
    snapshot.assert_match(await dbi.sequences.find().to_list(None), "sequences")


async def test_set_default(dbi, snapshot, test_otu, static_time):
    app = {
        "db": dbi,
        "settings": {
            "data_path": "/foo"
        }
    }

    test_otu["isolates"].append({
        "default": False,
        "id": "bar",
        "source_type": "isolate",
        "source_name": "A"
    })

    await dbi.otus.insert_one(test_otu)

    return_value = await virtool.otus.isolates.set_default(
        app,
        "6116cba1",
        "bar",
        "bob"
    )

    snapshot.assert_match(await dbi.otus.find_one(), "otu")
    snapshot.assert_match(await dbi.history.find_one(), "history")
    snapshot.assert_match(return_value, "return_value")
