import hashlib

import pytest
import virtool.errors
import virtool.users.db
import virtool.users.utils
import virtool.utils
from aiohttp.test_utils import make_mocked_coro
from virtool.users.db import generate_handle


@pytest.mark.parametrize("force_reset", [None, True, False])
async def test_compose_force_reset_update(force_reset):
    update = virtool.users.db.compose_force_reset_update(force_reset)

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

    coroutine = virtool.users.db.compose_groups_update(dbi, groups)

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
    mocker.patch("virtool.users.utils.hash_password",
                 return_value="new_hashed_password")

    update = virtool.users.db.compose_password_update(password)

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

    coroutine = virtool.users.db.compose_primary_group_update(
        dbi, bob["_id"], primary_group)

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
async def test_create(exists, force_reset, snapshot, mocker, dbi, bob):
    handle = "bob"
    password = "hello_world"

    mocker.patch("virtool.db.utils.get_new_id", return_value="abc123")

    mocker.patch(
        "virtool.db.utils.id_exists",
        new=make_mocked_coro(return_value=exists)
    )

    mocker.patch(
        "virtool.users.utils.hash_password",
        return_value="hashed_password"
    )

    # Ensure the force_reset is set to True by default.
    if force_reset is None:
        coroutine = virtool.users.db.create(
            dbi, password=password, handle=handle)
    else:
        coroutine = virtool.users.db.create(
            dbi, password=password, handle=handle, force_reset=force_reset)

    # Ensure an exception is raised if the user_id is already in use.
    if exists:
        with pytest.raises(virtool.errors.DatabaseError) as excinfo:
            await coroutine

        assert "User already exists" in str(excinfo.value)

    # Ensure the new user document is created and returned if the user_id is valid.
    else:
        assert await coroutine == snapshot


@pytest.mark.parametrize("exists", [True, False])
@pytest.mark.parametrize("administrator", [True, False])
async def test_edit(exists, administrator, snapshot, mocker, dbi, all_permissions, bob, static_time):
    """
    Test editing an existing user.

    """
    m_compose_force_reset_update = mocker.patch(
        "virtool.users.db.compose_force_reset_update",
        return_value={
            "force_reset": True
        }
    )

    m_compose_groups_update = mocker.patch(
        "virtool.users.db.compose_groups_update",
        new=make_mocked_coro({
            "groups": {
                "groups": ["peasants", "kings"],
                "permissions": all_permissions
            }
        })
    )

    m_compose_password_update = mocker.patch(
        "virtool.users.db.compose_password_update",
        return_value={
            "password": "new_hashed_password",
            "last_password_change": static_time.datetime,
            "invalidate_sessions": True
        }
    )

    m_compose_primary_group_update = mocker.patch(
        "virtool.users.db.compose_primary_group_update",
        new=make_mocked_coro({
            "primary_group": "peasants"
        })
    )

    if exists:
        await dbi.users.insert_one(bob)

    coroutine = virtool.users.db.edit(
        dbi,
        bob["_id"],
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

    assert await coroutine == snapshot

    m_compose_force_reset_update.assert_called_with(True)
    m_compose_groups_update.assert_called_with(dbi, ["peasants", "kings"])
    m_compose_password_update.assert_called_with("hello_world")
    m_compose_primary_group_update.assert_called_with(
        dbi, bob["_id"], "peasants")


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
        document["password"] = virtool.users.utils.hash_password("foobar")

    await dbi.users.insert_one(document)

    assert await virtool.users.db.validate_credentials(dbi, user_id, password) is result


@pytest.mark.parametrize("administrator", [True, False])
@pytest.mark.parametrize("elevate", [True, False])
@pytest.mark.parametrize("missing", [True, False])
async def test_update_sessions_and_keys(administrator, elevate, missing, snapshot, dbi, all_permissions, no_permissions):
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

    await virtool.users.db.update_sessions_and_keys(
        dbi,
        "bob",
        administrator,
        ["peasants", "kings"],
        target_permissions
    )

    assert await dbi.sessions.find_one() == snapshot
    assert await dbi.keys.find_one() == snapshot


async def test_generate_handle(mocker, dbi):
    """
    Test that generate_handle generates new handles until it generates one that doesn't already exist in the user
    collection
    """
    mocker.patch("random.randint", side_effect=[1, 1, 1, 2])

    await dbi.users.insert_one({
        "_id": "abc123",
        "handle": "foo-bar-1"
    })

    assert "foo-bar-2" == await generate_handle(dbi.users, "foo", "bar")
