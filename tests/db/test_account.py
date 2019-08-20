import pytest
from aiohttp.test_utils import make_mocked_coro
import virtool.db.account


def test_compose_password_update(mocker, static_time):
    """
    Test that compose password returns the expected update `dict`. Ensure the password is hashed using
    :func:`hash_password`.

    """
    m_hash_password = mocker.patch("virtool.users.hash_password", return_value="foobar")

    update = virtool.db.account.compose_password_update(
        "bob",
        "bar",
        "baz"
    )

    assert update == {
        "force_reset": False,
        "invalidate_sessions": False,
        "last_password_change": static_time.datetime,
        "password": "foobar"
    }

    m_hash_password.assert_called_with("baz")


@pytest.mark.parametrize("existing,expected", [
    ([], "foo_0"),
    (["bar_0"], "foo_0"),
    (["foo_0"], "foo_1"),
    (["foo_0", "foo_1"], "foo_2")
], ids=["no keys", "no matching key ids", "suffix 1", "suffix 2"])
async def test_get_alternate_id(existing, expected, dbi):
    for key_id in existing:
        await dbi.keys.insert_one({"id": key_id})

    assert await virtool.db.account.get_alternate_id(dbi, "foo") == expected


def test_generate_api_key(mocker):
    """
    Test that API keys are generated using UUID4 and that :func:`generate_api_key()` returns the raw and hashed version
    of the key. Hashing is done through a call to :func:`hash_api_key`.

    """
    class MockUUID4:
        hex = "foo"

    m_uuid = mocker.patch("uuid.uuid4", return_value=MockUUID4())
    m_hash_api_key = mocker.patch("virtool.users.hash_api_key", return_value="bar")

    assert virtool.db.account.generate_api_key() == ("foo", "bar")

    assert m_uuid.called

    m_hash_api_key.assert_called_with("foo")


@pytest.mark.parametrize("administrator", [True, False], ids=["administrator", "limited"])
@pytest.mark.parametrize("has_permission", [True, False], ids=["has permission", "missing permission"])
async def test_create_api_key(administrator, has_permission, mocker, dbi, static_time):
    """
    Test that an API key is created correctly with varying key owner administrator status and permissions.

    """
    m_get_alternate_id = mocker.patch("virtool.db.account.get_alternate_id", make_mocked_coro("foo_0"))
    m_generate_api_key = mocker.patch("virtool.db.account.generate_api_key", return_value=("bar", "baz"))

    groups = [
        "technicians",
        "managers"
    ]

    # Vary the key owner's administrator status and permissions.
    await dbi.users.insert_one({
        "_id": "bob",
        "administrator": administrator,
        "groups": groups,
        "permissions": {
            "create_sample": True,
            "create_subtraction": has_permission
        }

    })

    document = await virtool.db.account.create_api_key(
        dbi,
        "Foo",
        {
            "create_sample": True,
            "create_subtraction": True
        },
        "bob"
    )

    expected = {
        "id": "foo_0",
        "key": "bar",
        "name": "Foo",
        "created_at": static_time.datetime,
        "groups": groups,
        "permissions": {
            "cancel_job": False,
            "create_ref": False,
            "create_sample": True,
            "create_subtraction": False,
            "modify_hmm": False,
            "modify_subtraction": False,
            "remove_file": False,
            "remove_job": False,
            "upload_file": False
        }
    }

    # The key should not have the `create_subtraction` permission set unless the key owner is and administrator or has
    # the `create_subtraction` permission themselves.
    if administrator or has_permission:
        expected["permissions"]["create_subtraction"] = True

    # Check that expected functions were called.
    m_get_alternate_id.assert_called_with(dbi, "Foo")
    m_generate_api_key.assert_called_with()

    # Check returned document matches expected.
    assert document == expected

    # Modify expected document to check what we expect to have been inserted in the database.
    del expected["key"]

    expected.update({
        "_id": "baz",
        "user": {
            "id": "bob"
        }
    })

    assert await dbi.keys.find_one() == expected


