import gzip
import json
import os
import shutil
import sys

import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.db.references
import virtool.errors

TEST_IMPORT_FILE_PATH = os.path.join(sys.path[0], "tests", "test_files", "files", "import.json.gz")


async def add_group_or_user(db, ref_id, field, data):

    document = await db.references.find_one({"_id": ref_id}, [field])

    if not document:
        return None

    subdocument_id = data.get("group_id", None) or data["user_id"]

    if subdocument_id in [s["id"] for s in document[field]]:
        raise virtool.errors.DatabaseError(field + " already exists")

    rights = {key: data.get(key, False) for key in virtool.references.RIGHTS}

    subdocument = {
        "id": subdocument_id,
        "created_at": virtool.utils.timestamp(),
        **rights
    }

    await db.references.update_one({"_id": ref_id}, {
        "$push": {
            field: subdocument
        }
    })

    return subdocument


@pytest.mark.parametrize("error", [None, "duplicate", "missing"])
@pytest.mark.parametrize("field", ["group", "user"])
@pytest.mark.parametrize("rights", [True, False])
async def test_add_group_or_user(error, field, rights, test_dbi, static_time):

    ref_id = "foo"

    subdocuments = [
        {
            "id": "bar"
        },
        {
            "id": "baz"
        }
    ]

    if error != "missing":
        await test_dbi.references.insert_one({

            "_id": ref_id,
            "groups": subdocuments,
            "users": subdocuments
        })

    subdocument_id = "bar" if error == "duplicate" else "buzz"

    payload = {
        field + "_id": subdocument_id
    }

    if rights:
        payload["build"] = True

    task = virtool.db.references.add_group_or_user(test_dbi, ref_id, field + "s", payload)

    if error == "duplicate":
        with pytest.raises(virtool.errors.DatabaseError) as err:
            await task

        assert field + " already exists" in str(err)

    elif error == "missing":
        assert await task is None

    else:
        await task

        expected = {
            "id": subdocument_id,
            "created_at": static_time,
            "build": rights,
            "modify": False,
            "modify_otu": False,
            "remove": False
        }

        assert await test_dbi.references.find_one() == {
            "_id": ref_id,
            "groups": subdocuments + ([expected] if field == "group" else []),
            "users": subdocuments + ([expected] if field == "user" else [])
        }


@pytest.mark.parametrize("missing", [None, "reference", "subdocument"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_edit_group_or_user(field, missing, test_dbi, static_time):

    ref_id = "foo"

    subdocuments = [
        {
            "id": "bar"
        },
        {
            "id": "baz"
        }
    ]

    if missing != "reference":
        await test_dbi.references.insert_one({
            "_id": ref_id,
            "groups": subdocuments,
            "users": subdocuments
        })

    subdocument_id = "buzz" if missing == "subdocument" else "baz"

    subdocument = await virtool.db.references.edit_group_or_user(test_dbi, ref_id, subdocument_id, field + "s", {
        "build": True,
        "remove": True
    })

    if missing:
        assert subdocument is None

    else:
        expected = {
            "id": subdocument_id,
            "build": True,
            "modify": False,
            "modify_otu": False,
            "remove": True
        }

        assert await test_dbi.references.find_one() == {
            "_id": ref_id,
            "groups": (subdocuments[:1] + [expected]) if field == "group" else subdocuments,
            "users": (subdocuments[:1] + [expected]) if field == "user" else subdocuments
        }


@pytest.mark.parametrize("field", ["groups", "users"])
async def test_delete_group_or_user(field, test_dbi):

    ref_id = "foo"

    subdocuments = [
        {
            "id": "bar"
        },
        {
            "id": "baz"
        }
    ]

    await test_dbi.references.insert_one({
        "_id": ref_id,
        "groups": subdocuments,
        "users": subdocuments
    })

    await virtool.db.references.delete_group_or_user(test_dbi, "foo", "bar", field)

    assert await test_dbi.references.find_one() == {
        "_id": ref_id,
        "groups": [subdocuments[1]] if field == "groups" else subdocuments,
        "users": [subdocuments[1]] if field == "users" else subdocuments
    }


async def test_import(mocker, tmpdir, test_motor, static_time):

    with gzip.open(TEST_IMPORT_FILE_PATH, "rt") as f:
        data = json.load(f)

    app = {
        "db": test_motor,
        "run_in_thread": make_mocked_coro(return_value=data)
    }

    shutil.copy(TEST_IMPORT_FILE_PATH, str(tmpdir))

    m = mocker.patch("virtool.db.processes.update", make_mocked_coro())

    await virtool.db.references.finish_import(
        app,
        os.path.join(str(tmpdir), "import.json.gz"),
        "bar",
        static_time,
        "foo",
        "bob"
    )
