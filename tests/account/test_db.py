import pytest
from aiohttp.test_utils import make_mocked_coro
from virtool.account.data import AccountData
from virtool.users.utils import Permission
import virtool.account.db
from virtool.account.oas import CreateKeysSchema
from virtool.groups.oas import EditPermissionsSchema


def test_compose_password_update(mocker, static_time):
    """
    Test that compose password returns the expected update `dict`. Ensure the password is hashed
    using :func:`hash_password`.

    """
    m_hash_password = mocker.patch(
        "virtool.users.utils.hash_password", return_value="foobar"
    )

    update = virtool.account.db.compose_password_update("baz")

    assert update == {
        "force_reset": False,
        "invalidate_sessions": False,
        "last_password_change": static_time.datetime,
        "password": "foobar",
    }

    m_hash_password.assert_called_with("baz")


@pytest.mark.parametrize(
    "existing,expected",
    [
        ([], "foo_0"),
        (["bar_0"], "foo_0"),
        (["foo_0"], "foo_1"),
        (["foo_0", "foo_1"], "foo_2"),
    ],
    ids=["no keys", "no matching key ids", "suffix 1", "suffix 2"],
)
async def test_get_alternate_id(existing, expected, dbi):
    for key_id in existing:
        await dbi.keys.insert_one({"id": key_id})

    assert await virtool.account.db.get_alternate_id(dbi, "foo") == expected


@pytest.mark.parametrize(
    "administrator", [True, False], ids=["administrator", "limited"]
)
@pytest.mark.parametrize(
    "has_permission", [True, False], ids=["has permission", "missing permission"]
)
async def test_create_api_key(administrator, has_permission, mocker, dbi, static_time):
    """
    Test that an API key is created correctly with varying key owner administrator status and
    permissions.

    """
    m_get_alternate_id = mocker.patch(
        "virtool.account.db.get_alternate_id", make_mocked_coro("foo_0")
    )

    m_generate_key = mocker.patch(
        "virtool.utils.generate_key", return_value=("bar", "baz")
    )

    groups = [{"id": "technicians"}, {"id": "managers"}]

    # Vary the key owner's administrator status and permissions.
    await dbi.users.insert_one(
        {
            "_id": "bob",
            "administrator": administrator,
            "groups": groups,
            "permissions": {
                Permission.create_sample.value: True,
                "modify_subtraction": has_permission,
            },
        }
    )

    account = AccountData(dbi)
    data = CreateKeysSchema(
        name="Foo",
        permissions=EditPermissionsSchema(create_sample=True, modify_subtraction=True),
    )

    document = await account.create_key(data, "bob")
    document = document.dict()

    permissions = {p.value: False for p in Permission}
    permissions[Permission.create_sample.value] = True
    permissions["modify_subtraction"] = False

    expected = {
        "administrator": administrator,
        "id": "foo_0",
        "name": "Foo",
        "created_at": static_time.datetime,
        "groups": groups,
        "permissions": permissions,
    }

    # The key should not have the `create_subtraction` permission set unless the key owner is and
    # administrator or has the `create_subtraction` permission themselves.
    if administrator or has_permission:
        expected["permissions"]["modify_subtraction"] = True

    # Check that expected functions were called.
    m_get_alternate_id.assert_called_with(dbi, "Foo")
    m_generate_key.assert_called()

    # Check returned document matches expected.
    for group in expected["groups"]:
        group.update({"name": group["id"]})

    assert document == expected

    # Modify expected document to check what we expect to have been inserted in the database.
    del expected["groups"][0]["name"]
    del expected["groups"][1]["name"]

    expected.update({"_id": "baz", "user": {"id": "bob"}})

    assert await dbi.keys.find_one() == expected
