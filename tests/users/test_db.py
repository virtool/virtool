import hashlib

import pytest

import virtool.errors
from virtool.mongo.transforms import apply_transforms
from virtool.users.db import (
    AttachUserTransform,
    compose_groups_update,
    compose_primary_group_update,
    update_keys,
    validate_credentials,
)
from virtool.users.utils import Permission
from virtool.users.utils import hash_password
from virtool.utils import random_alphanumeric


@pytest.mark.parametrize("multiple", [True, False])
async def test_attach_user_transform(multiple, snapshot, mongo, fake2):
    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    documents = {"_id": "bar", "user": {"id": user_1.id}}

    if multiple:
        documents = [
            documents,
            {"_id": "foo", "user": {"id": user_2.id}},
            {"_id": "baz", "user": {"id": user_1.id}},
        ]

    assert await apply_transforms(documents, [AttachUserTransform(mongo)]) == snapshot


@pytest.mark.parametrize("groups", [None, [], ["kings"], ["kings", "peasants"]])
async def test_compose_groups_update(
    groups, mongo, kings, all_permissions, no_permissions
):
    await mongo.groups.insert_many([kings], session=None)

    coroutine = compose_groups_update(mongo, groups)

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
        }


@pytest.mark.parametrize("primary_group", [None, "kings", "lords", "peasants", "none"])
async def test_compose_primary_group_update(primary_group, mongo, bob, kings, peasants):
    await mongo.users.insert_one(bob)

    await mongo.groups.insert_many([kings, peasants], session=None)

    coroutine = compose_primary_group_update(mongo, bob["_id"], primary_group)

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
        assert update == {"primary_group": primary_group}


@pytest.mark.parametrize(
    "user_id,password,result",
    [
        ("test", "foobar", True),
        ("baz", "foobar", False),
        ("test", "baz", False),
        ("baz", "baz", False),
    ],
)
@pytest.mark.parametrize("legacy", [True, False])
async def test_validate_credentials(legacy, user_id, password, result, mongo):
    """
    Test that valid, bcrypt-based credentials work.

    """
    document = {"_id": "test"}

    if legacy:
        salt = random_alphanumeric(24)

        document.update(
            {
                "salt": salt,
                "password": hashlib.sha512(
                    salt.encode("utf-8") + "foobar".encode("utf-8")
                ).hexdigest(),
            }
        )
    else:
        document["password"] = hash_password("foobar")

    await mongo.users.insert_one(document)

    assert await validate_credentials(mongo, user_id, password) is result


@pytest.mark.parametrize("administrator", [True, False])
@pytest.mark.parametrize("elevate", [True, False])
@pytest.mark.parametrize("missing", [True, False])
async def test_update_keys(
    administrator, elevate, missing, snapshot, mongo, all_permissions, no_permissions
):
    """
    Test that permissions assigned to keys and sessions are updated correctly.

    Keys should only lose permissions that are disabled on the account. They should not received new permissions as part
    of a user update.

    Sessions should be changed to match the user account permissions.

    """
    permissions = dict(no_permissions if elevate else all_permissions)

    if missing and not elevate:
        permissions.update(
            {Permission.create_sample.value: False, Permission.upload_file.value: False}
        )

    await mongo.keys.insert_one(
        {
            "_id": "foobar",
            "administrator": False,
            "groups": ["peasants"],
            "permissions": permissions,
            "user": {"id": "bob"},
        }
    )

    target_permissions = all_permissions if elevate else no_permissions


    await update_keys(
        mongo, "bob", administrator, ["peasants", "kings"], target_permissions
    )

    assert await mongo.keys.find_one() == snapshot
