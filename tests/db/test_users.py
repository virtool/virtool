import hashlib
import pytest
from aiohttp.test_utils import make_mocked_coro

import virtool.db.users
import virtool.errors
import virtool.users
import virtool.utils


@pytest.mark.parametrize("force_reset", [None, True, False])
async def test_compose_force_reset_update(force_reset):
    update = virtool.db.users.compose_force_reset_update(force_reset)

    if force_reset is None:
        assert update == {}
    else:
        assert update == {
            "force_reset": force_reset,
            "invalidate_sessions": True
        }


@pytest.mark.parametrize("groups", [None, [], ["kings"], ["kings", "peasants"]])
async def test_compose_groups_update(groups, dbi, kings, all_permissions, no_permissions):
    await dbi.groups.insert_many([kings])

    coroutine = virtool.db.users.compose_groups_update(dbi, groups)

    if groups == ["kings", "peasants"]:
        with pytest.raises(virtool.errors.DatabaseError) as excinfo:
            await coroutine

        assert "Non-existent groups: peasants" in str(excinfo.value)
        return

    update = await coroutine

    if groups is None:
        assert update == {}
    else:
        assert update == {
            "groups": groups,
            "permissions": no_permissions if groups == [] else all_permissions
        }


@pytest.mark.parametrize("password", [None, "another_password"])
async def test_compose_password_update(password, mocker, static_time):
    mocker.patch("virtool.users.hash_password", return_value="new_hashed_password")

    update = virtool.db.users.compose_password_update(password)

    if password is None:
        assert update == {}
    else:
        assert update == {
            "password": "new_hashed_password",
            "last_password_change": static_time.datetime,
            "invalidate_sessions": True
        }


@pytest.mark.parametrize("primary_group", [None, "kings", "lords", "peasants", "none"])
async def test_compose_primary_group_update(primary_group, dbi, bob, kings, peasants):
    await dbi.users.insert_one(bob)

    await dbi.groups.insert_many([kings, peasants])

    coroutine = virtool.db.users.compose_primary_group_update(dbi, "bob", primary_group)

    if primary_group == "lords" or primary_group == "kings":
        with pytest.raises(virtool.errors.DatabaseError) as excinfo:
            await coroutine

        if primary_group == "lords":
            assert "Non-existent group: lords" in str(excinfo.value)
            return

        if primary_group == "kings":
            assert "User is not member of group" in str(excinfo.value)
            return

        raise excinfo

    update = await coroutine

    if primary_group is None:
        assert update == {}
    else:
        assert update == {
            "primary_group": primary_group
        }


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("force_reset", [None, True, False])
async def test_create(exists, force_reset, mocker, dbi, bob):

    user_id = "bob"
    password = "hello_world"

    # Ensure the force_reset is set to True by default.
    if force_reset is None:
        args = (dbi, user_id, password)
    else:
        args = (dbi, user_id, password, force_reset)

    mocker.patch("virtool.db.utils.id_exists", new=make_mocked_coro(return_value=exists))
    mocker.patch("virtool.users.hash_password", return_value="hashed_password")

    coroutine = virtool.db.users.create(*args)

    # Ensure an exception is raised if the user_id is already in use.
    if exists:
        with pytest.raises(virtool.errors.DatabaseError) as excinfo:
            await coroutine

        assert "User already exists" in str(excinfo.value)

    # Ensure the new user document is created and returned if the user_id is valid.
    else:
        document = await coroutine

        bob.update({
            "force_reset": force_reset is not False,
            "groups": []
        })

        assert await dbi.users.find_one() == document == bob


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("administrator", [True, False])
async def test_edit(exists, administrator, mocker, dbi, all_permissions, bob, static_time):
    """
    Test editing an existing user.

    """
    administrator_update = {
        "administrator": administrator
    }

    force_reset_update = {
        "force_reset": True
    }

    groups_update = {
        "groups": {
            "groups": ["peasants", "kings"],
            "permissions": all_permissions
        }
    }

    password_update = {
        "password": "new_hashed_password",
        "last_password_change": static_time.datetime,
        "invalidate_sessions": True
    }

    primary_group_update = {
        "primary_group": "peasants"
    }

    m_compose_force_reset_update = mocker.patch(
        "virtool.db.users.compose_force_reset_update",
        return_value= force_reset_update
    )

    m_compose_groups_update = mocker.patch(
        "virtool.db.users.compose_groups_update",
        new=make_mocked_coro(groups_update)
    )

    m_compose_password_update = mocker.patch(
        "virtool.db.users.compose_password_update",
        return_value=password_update
    )

    m_compose_primary_group_update = mocker.patch(
        "virtool.db.users.compose_primary_group_update",
        new=make_mocked_coro(primary_group_update)
    )

    if exists:
        await dbi.users.insert_one(bob)

    coroutine = virtool.db.users.edit(
        dbi,
        "bob",
        administrator,
        True,
        ["peasants", "kings"],
        "hello_world",
        "peasants"
    )

    if not exists:
        with pytest.raises(virtool.errors.DatabaseError) as excinfo:
            await coroutine

        assert "User does not exist" == str(excinfo.value)

        return

    document = await coroutine

    assert document == await dbi.users.find_one("bob") == {
        **bob,
        **administrator_update,
        **force_reset_update,
        **groups_update,
        **password_update,
        **primary_group_update
    }

    m_compose_force_reset_update.assert_called_with(True)

    m_compose_groups_update.assert_called_with(dbi, ["peasants", "kings"])

    m_compose_password_update.assert_called_with("hello_world")

    m_compose_primary_group_update.assert_called_with(dbi, "bob", "peasants")


@pytest.mark.parametrize("user_id,password,result", [
    ("test", "foobar", True),
    ("baz", "foobar", False),
    ("test", "baz", False),
    ("baz", "baz", False)
])
@pytest.mark.parametrize("legacy", [True, False])
async def test_validate_credentials(legacy, user_id, password, result, dbi):
    """
    Test that valid, bcrypt-based credentials work.

    """
    document = {
        "_id": "test"
    }

    if legacy:
        salt = virtool.utils.random_alphanumeric(24)

        document.update({
            "salt": salt,
            "password": hashlib.sha512(salt.encode("utf-8") + "foobar".encode("utf-8")).hexdigest()
        })
    else:
        document["password"] = virtool.users.hash_password("foobar")

    await dbi.users.insert_one(document)

    assert await virtool.db.users.validate_credentials(dbi, user_id, password) is result


@pytest.mark.parametrize("administrator", [True, False])
@pytest.mark.parametrize("elevate", [True, False])
@pytest.mark.parametrize("missing", [True, False])
async def test_update_sessions_and_keys(administrator, elevate, missing, dbi, all_permissions, no_permissions):
    """
    Test that permissions assigned to keys and sessions are updated correctly.

    Keys should only lose permissions that are disabled on the account. They should not received new permissions as part
    of a user update.

    Sessions should be changed to match the user account permissions.

    """
    permissions = dict(no_permissions if elevate else all_permissions)

    if missing and not elevate:
        permissions.update({
            "create_sample": False,
            "upload_file": False
        })

    await dbi.keys.insert_one({
        "_id": "foobar",
        "administrator": False,
        "groups": ["peasants"],
        "permissions": permissions,
        "user": {
            "id": "bob"
        }
    })

    await dbi.sessions.insert_one({
        "_id": "foobar",
        "administrator": False,
        "groups": ["peasants"],
        "permissions": permissions,
        "user": {
            "id": "bob"
        }
    })

    target_permissions = all_permissions if elevate else no_permissions

    await virtool.db.users.update_sessions_and_keys(
        dbi,
        "bob",
        administrator,
        ["peasants", "kings"],
        target_permissions
    )

    assert await dbi.sessions.find_one() == {
        "_id": "foobar",
        "administrator": administrator,
        "groups": ["peasants", "kings"],
        "permissions": target_permissions,
        "user": {
            "id": "bob"
        }
    }

    for key, value in permissions.items():
        permissions[key] = value and target_permissions[key]

    assert await dbi.keys.find_one() == {
        "_id": "foobar",
        "administrator": administrator,
        "groups": ["peasants", "kings"],
        "permissions": permissions,
        "user": {
            "id": "bob"
        }
    }


