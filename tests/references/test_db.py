import pytest
import virtool.errors
import virtool.references.db

RIGHTS = {"build": False, "modify": False, "modify_otu": False, "remove": False}


@pytest.mark.parametrize("error", [None, "duplicate", "missing", "missing_member"])
@pytest.mark.parametrize("field", ["group", "user"])
@pytest.mark.parametrize("rights", [True, False])
async def test_add_group_or_user(error, field, rights, dbi, static_time):

    ref_id = "foo"

    subdocuments = [
        {**RIGHTS, "id": "bar", "handle": "foo"},
        {**RIGHTS, "id": "baz", "handle": "boo"},
    ]

    if error != "missing":
        await dbi.references.insert_one(
            {"_id": ref_id, "groups": subdocuments, "users": subdocuments}
        )

    if error != "missing_member":
        for (_id, handle) in [("bar", "foo"), ("buzz", "boo")]:
            await dbi.groups.insert_one({"_id": _id})
            await dbi.users.insert_one({"_id": _id, "handle": handle})

    subdocument_id = "bar" if error == "duplicate" else "buzz"

    payload = {field + "_id": subdocument_id}

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
            "remove": False,
        }

        assert await dbi.references.find_one() == {
            "_id": ref_id,
            "groups": subdocuments + ([expected] if field == "group" else []),
            "users": subdocuments + ([expected] if field == "user" else []),
        }


@pytest.mark.parametrize("admin", [True, False])
@pytest.mark.parametrize("ref", ["baz", {"_id": "baz"}, None])
@pytest.mark.parametrize("member", [None, "group", "user"])
@pytest.mark.parametrize(
    "right,expect", [("read", True), ("modify_otu", True), ("modify", False)]
)
async def test_check_right(admin, expect, member, ref, right, mocker, mock_req, dbi):
    mock_req.app = {"db": dbi}

    mock_req["client"] = mocker.Mock()

    mock_req["client"].administrator = admin

    mock_req["client"].user_id = "bar"

    mock_req["client"].groups = ["foo"]

    reference = {
        "_id": "baz",
        "groups": [
            {
                "id": "foo" if member == "group" else "none",
                "read": True,
                "modify": False,
                "modify_otu": True,
            }
        ],
        "users": [
            {
                "id": "bar" if member == "user" else "none",
                "read": True,
                "modify": False,
                "modify_otu": True,
            }
        ],
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


@pytest.mark.parametrize("missing", [None, "reference", "subdocument"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_edit_member(field, missing, snapshot, dbi, static_time):

    ref_id = "foo"

    subdocuments = [{**RIGHTS, "id": "bar"}, {**RIGHTS, "id": "baz"}]

    if missing != "reference":
        await dbi.references.insert_one(
            {"_id": ref_id, "groups": subdocuments, "users": subdocuments}
        )

    subdocument_id = "buzz" if missing == "subdocument" else "baz"

    subdocument = await virtool.references.db.edit_group_or_user(
        dbi, ref_id, subdocument_id, field + "s", {"build": True, "remove": True}
    )

    assert subdocument == snapshot
    assert await dbi.references.find_one() == snapshot


@pytest.mark.parametrize("field", ["groups", "users"])
async def test_delete_member(field, snapshot, dbi):

    ref_id = "foo"

    subdocuments = [{"id": "bar"}, {"id": "baz"}]

    await dbi.references.insert_one(
        {"_id": ref_id, "groups": subdocuments, "users": subdocuments}
    )

    subdocument_id = await virtool.references.db.delete_group_or_user(
        dbi, "foo", "bar", field
    )

    assert subdocument_id == snapshot
    assert await dbi.references.find_one() == snapshot
