from aiohttp.test_utils import make_mocked_coro

import pytest

import virtool.references.db
import virtool.errors

RIGHTS = {
    "build": False,
    "modify": False,
    "modify_otu": False,
    "remove": False
}


@pytest.mark.parametrize("error", [None, "duplicate", "missing", "missing_member"])
@pytest.mark.parametrize("field", ["group", "user"])
@pytest.mark.parametrize("rights", [True, False])
async def test_add_group_or_user(error, field, rights, dbi, static_time):

    ref_id = "foo"

    subdocuments = [
        {**RIGHTS, "id": "bar"},
        {**RIGHTS, "id": "baz"}
    ]

    if error != "missing":
        await dbi.references.insert_one({
            "_id": ref_id,
            "groups": subdocuments,
            "users": subdocuments
        })

    if error != "missing_member":
        for _id in ["bar", "buzz"]:
            await dbi.groups.insert_one({"_id": _id})
            await dbi.users.insert_one({"_id": _id})

    subdocument_id = "bar" if error == "duplicate" else "buzz"

    payload = {
        field + "_id": subdocument_id
    }

    if rights:
        payload["build"] = True

    task = virtool.references.db.add_group_or_user(dbi, ref_id, field + "s", payload)

    if error == "duplicate" or error == "missing_member":
        with pytest.raises(virtool.errors.DatabaseError) as excinfo:
            await task

        if error == "duplicate":
            assert field + " already exists" in str(excinfo.value)

        else:
            assert field + " does not exist" in str(excinfo.value)

    elif error == "missing":
        assert await task is None

    else:
        await task

        expected = {
            "id": subdocument_id,
            "created_at": static_time.datetime,
            "build": rights,
            "modify": False,
            "modify_otu": False,
            "remove": False
        }

        assert await dbi.references.find_one() == {
            "_id": ref_id,
            "groups": subdocuments + ([expected] if field == "group" else []),
            "users": subdocuments + ([expected] if field == "user" else [])
        }


@pytest.mark.parametrize("admin", [True, False])
@pytest.mark.parametrize("ref", ["baz", {"_id": "baz"}, None])
@pytest.mark.parametrize("member", [None, "group", "user"])
@pytest.mark.parametrize("right,expect", [
    ("read", True),
    ("modify_otu", True),
    ("modify", False)
])
async def test_check_right(admin, expect, member, ref, right, mocker, mock_req, dbi):
    mock_req.app = {
        "db": dbi
    }

    mock_req["client"] = mocker.Mock()

    mock_req["client"].administrator = admin

    mock_req["client"].user_id = "bar"

    mock_req["client"].groups = [
        "foo"
    ]

    reference = {
        "_id": "baz",
        "groups": [
            {
                "id": "foo" if member == "group" else "none",
                "read": True,
                "modify": False,
                "modify_otu": True
            }
        ],
        "users": [
            {
                "id": "bar" if member == "user" else "none",
                "read": True,
                "modify": False,
                "modify_otu": True
            }
        ]
    }

    await dbi.references.insert_one(reference)

    if ref is None:
        ref = reference

    result = await virtool.references.db.check_right(mock_req, ref, right)

    if admin:
        assert result is True
        return

    if not admin and member is None:
        return False

    assert result == expect


async def test_create_manifest(dbi, test_otu):
    await dbi.otus.insert_many([
        test_otu,
        dict(test_otu, _id="foo", version=5),
        dict(test_otu, _id="baz", version=3, reference={"id": "123"}),
        dict(test_otu, _id="bar", version=11)
    ])

    assert await virtool.references.db.get_manifest(dbi, "hxn167") == {
        "6116cba1": 0,
        "foo": 5,
        "bar": 11
    }


class TestEdit:

    @pytest.mark.parametrize("control_exists", [True, False])
    @pytest.mark.parametrize("control_id", [None, "", "baz"])
    async def test_control(self, control_exists, control_id, mocker, snapshot, dbi):
        """
        Test that the `internal_control` field is correctly set with various `internal_control` input value and the case
        where the internal control ID refers to a non-existent OTU.

        The field should only be set when the input value is truthy and the control ID exists.

        """
        await dbi.users.insert_one({
            "_id": "bob",
            "identicon": "abc123"
        })

        await dbi.references.insert_one({
            "_id": "foo",
            "data_type": "genome",
            "internal_control": {
                "id": "bar"
            },
            "users": [
                {
                    "id": "bob"
                }
            ]
        })

        update = {
            "name": "Tester",
            "description": "This is a test reference."
        }

        if control_id is not None:
            update["internal_control"] = control_id

        mocker.patch(
            "virtool.references.db.get_internal_control",
            make_mocked_coro({"id": "baz"} if control_exists else None)
        )

        document = await virtool.references.db.edit(
            dbi,
            "foo",
            update
        )

        snapshot.assert_match(await dbi.references.find_one())
        snapshot.assert_match(document)

    async def test_reference_name(self, snapshot, dbi):
        """
        Test that analyses that are linked to the edited reference have their `reference.name` fields changed when
        the `name` field of the reference changes.

        """
        await dbi.users.insert_one({
            "_id": "bob",
            "identicon": "abc123"
        })

        await dbi.references.insert_one({
            "_id": "foo",
            "name": "Foo",
            "data_type": "genome",
            "internal_control": {
                "id": "bar"
            },
            "users": [
                {
                    "id": "bob"
                }
            ]
        })

        await dbi.analyses.insert_many([
            {
                "_id": "baz",
                "reference": {
                    "id": "foo",
                    "name": "Foo"
                }
            },
            {
                "_id": "boo",
                "reference": {
                    "id": "foo",
                    "name": "Foo"
                }
            }
        ])

        update = {
            "name": "Bar"
        }

        await virtool.references.db.edit(
            dbi,
            "foo",
            update
        )

        snapshot.assert_match(await dbi.references.find_one())
        snapshot.assert_match(await dbi.analyses.find().to_list(None))


@pytest.mark.parametrize("missing", [None, "reference", "subdocument"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_edit_group_or_user(field, missing, dbi, static_time):

    ref_id = "foo"

    subdocuments = [
        {**RIGHTS, "id": "bar"},
        {**RIGHTS, "id": "baz"}
    ]

    if missing != "reference":
        await dbi.references.insert_one({
            "_id": ref_id,
            "groups": subdocuments,
            "users": subdocuments
        })

    subdocument_id = "buzz" if missing == "subdocument" else "baz"

    subdocument = await virtool.references.db.edit_group_or_user(dbi, ref_id, subdocument_id, field + "s", {
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

        assert await dbi.references.find_one() == {
            "_id": ref_id,
            "groups": (subdocuments[:1] + [expected]) if field == "group" else subdocuments,
            "users": (subdocuments[:1] + [expected]) if field == "user" else subdocuments
        }


@pytest.mark.parametrize("field", ["groups", "users"])
async def test_delete_group_or_user(field, dbi):

    ref_id = "foo"

    subdocuments = [
        {
            "id": "bar"
        },
        {
            "id": "baz"
        }
    ]

    await dbi.references.insert_one({
        "_id": ref_id,
        "groups": subdocuments,
        "users": subdocuments
    })

    await virtool.references.db.delete_group_or_user(dbi, "foo", "bar", field)

    assert await dbi.references.find_one() == {
        "_id": ref_id,
        "groups": [subdocuments[1]] if field == "groups" else subdocuments,
        "users": [subdocuments[1]] if field == "users" else subdocuments
    }
