import os
import sys

import pytest

import virtool.db.references
import virtool.errors

RIGHTS = {
    "build": False,
    "modify": False,
    "modify_otu": False,
    "remove": False
}

TEST_IMPORT_FILE_PATH = os.path.join(sys.path[0], "tests", "test_files", "files", "import.json.gz")


@pytest.mark.parametrize("error", [None, "duplicate", "missing", "missing_member"])
@pytest.mark.parametrize("field", ["group", "user"])
@pytest.mark.parametrize("rights", [True, False])
async def test_add_group_or_user(error, field, rights, test_dbi, static_time):

    ref_id = "foo"

    subdocuments = [
        {**RIGHTS, "id": "bar"},
        {**RIGHTS, "id": "baz"}
    ]

    if error != "missing":
        await test_dbi.references.insert_one({
            "_id": ref_id,
            "groups": subdocuments,
            "users": subdocuments
        })

    if error != "missing_member":
        for _id in ["bar", "buzz"]:
            await test_dbi.groups.insert_one({"_id": _id})
            await test_dbi.users.insert_one({"_id": _id})

    subdocument_id = "bar" if error == "duplicate" else "buzz"

    payload = {
        field + "_id": subdocument_id
    }

    if rights:
        payload["build"] = True

    task = virtool.db.references.add_group_or_user(test_dbi, ref_id, field + "s", payload)

    if error == "duplicate" or error == "missing_member":
        with pytest.raises(virtool.errors.DatabaseError) as err:
            await task

        if error == "duplicate":
            assert field + " already exists" in str(err)

        else:
            assert field + " does not exist" in str(err)

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


async def test_create_manifest(test_motor, test_otu):
    await test_motor.otus.insert_many([
        test_otu,
        dict(test_otu, _id="foo", version=5),
        dict(test_otu, _id="baz", version=3, reference={"id": "123"}),
        dict(test_otu, _id="bar", version=11)
    ])

    assert await virtool.db.references.get_manifest(test_motor, "hxn167") == {
        "6116cba1": 0,
        "foo": 5,
        "bar": 11
    }


@pytest.mark.parametrize("missing", [None, "reference", "subdocument"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_edit_group_or_user(field, missing, test_dbi, static_time):

    ref_id = "foo"

    subdocuments = [
        {**RIGHTS, "id": "bar"},
        {**RIGHTS, "id": "baz"}
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
