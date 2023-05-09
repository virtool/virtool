import pytest

import virtool.errors
import virtool.references.db
from virtool.startup import startup_http_client


@pytest.fixture
async def fake_app():
    version = "v1.2.3"

    app = {"version": version}

    yield app

    # Close real session created in `test_startup_executors()`.
    try:
        await app["client"].close()
    except TypeError:
        pass


RIGHTS = {"build": False, "modify": False, "modify_otu": False, "remove": False}


@pytest.mark.parametrize("error", [None, "duplicate", "missing", "missing_member"])
@pytest.mark.parametrize("field", ["group", "user"])
@pytest.mark.parametrize("rights", [True, False])
async def test_add_group_or_user(error, field, rights, mongo, static_time):
    ref_id = "foo"

    subdocuments = [
        {**RIGHTS, "id": "bar", "handle": "foo"},
        {**RIGHTS, "id": "baz", "handle": "boo"},
    ]

    if error != "missing":
        await mongo.references.insert_one(
            {"_id": ref_id, "groups": subdocuments, "users": subdocuments}
        )

    if error != "missing_member":
        for _id, handle in [("bar", "foo"), ("buzz", "boo")]:
            await mongo.groups.insert_one({"_id": _id})
            await mongo.users.insert_one({"_id": _id, "handle": handle})

    subdocument_id = "bar" if error == "duplicate" else "buzz"

    payload = {field + "_id": subdocument_id}

    if rights:
        payload["build"] = True

    task = virtool.references.db.add_group_or_user(mongo, ref_id, field + "s", payload)

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

        assert await mongo.references.find_one() == {
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
async def test_check_right(admin, expect, member, ref, right, mocker, mock_req, mongo):
    mock_req.app = {"db": mongo}

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

    await mongo.references.insert_one(reference)

    if ref is None:
        ref = reference

    result = await virtool.references.db.check_right(mock_req, ref, right)

    if admin:
        assert result is True
        return

    if not admin and member is None:
        return False

    assert result == expect


async def test_create_manifest(mongo, test_otu):
    await mongo.otus.insert_many(
        [
            test_otu,
            dict(test_otu, _id="foo", version=5),
            dict(test_otu, _id="baz", version=3, reference={"id": "123"}),
            dict(test_otu, _id="bar", version=11),
        ],
        session=None,
    )

    assert await virtool.references.db.get_manifest(mongo, "hxn167") == {
        "6116cba1": 0,
        "foo": 5,
        "bar": 11,
    }


@pytest.mark.parametrize("missing", [None, "reference", "subdocument"])
@pytest.mark.parametrize("field", ["group", "user"])
async def test_edit_member(field, missing, snapshot, mongo, static_time):
    ref_id = "foo"

    subdocuments = [{**RIGHTS, "id": "bar"}, {**RIGHTS, "id": "baz"}]

    if missing != "reference":
        await mongo.references.insert_one(
            {"_id": ref_id, "groups": subdocuments, "users": subdocuments}
        )

    subdocument_id = "buzz" if missing == "subdocument" else "baz"

    subdocument = await virtool.references.db.edit_group_or_user(
        mongo, ref_id, subdocument_id, field + "s", {"build": True, "remove": True}
    )

    assert subdocument == snapshot
    assert await mongo.references.find_one() == snapshot


@pytest.mark.parametrize("field", ["groups", "users"])
async def test_delete_member(field, snapshot, mongo):
    ref_id = "foo"

    subdocuments = [{"id": "bar"}, {"id": "baz"}]

    await mongo.references.insert_one(
        {"_id": ref_id, "groups": subdocuments, "users": subdocuments}
    )

    subdocument_id = await virtool.references.db.delete_group_or_user(
        mongo, "foo", "bar", field
    )

    assert subdocument_id == snapshot
    assert await mongo.references.find_one() == snapshot


@pytest.mark.parametrize("status", [200, 304, 404])
# @pytest.mark.parametrize("ignore_errors", [True, False])
async def test_fetch_and_update_release(mongo, status, fake_app, snapshot, static_time):
    await startup_http_client(fake_app)

    etag = None

    if status == 200:
        etag = 'W/"409d3d915cefec6a8d2004c44c9e5456961777ca3b7e4310458dd8707d6a8d08"'

    if status == 304:
        etag = '"f1a3f4d9330494be0ea4bb8de666cb21"'

    if status == 404:
        pass

    await mongo.references.insert_one(
        {
            "_id": "fake_ref_id",
            "installed": {"name": "1.0.0-fake-install"},
            "release": {"etag": etag, "name": "1.0.0-fake-release"},
            "remotes_from": {"slug": "virtool/ref-plant-viruses"},
        }
    )

    assert (
        await virtool.references.db.fetch_and_update_release(
            mongo, fake_app["client"], "fake_ref_id", False
        )
        == snapshot
    )
