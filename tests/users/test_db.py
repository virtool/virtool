import hashlib

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError
from virtool.data.transforms import apply_transforms
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.users.db import (
    compose_groups_update,
)
from virtool.users.mongo import (
    validate_credentials,
    update_keys,
    compose_primary_group_update,
)
from virtool.users.transforms import AttachUserTransform
from virtool.users.utils import Permission
from virtool.users.utils import hash_password
from virtool.utils import random_alphanumeric


@pytest.fixture
async def _group_one_and_two(no_permissions: [str, bool], pg: AsyncEngine):
    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLGroup(
                    id=1,
                    name="group_1",
                    legacy_id="group_1",
                    permissions=no_permissions,
                ),
                SQLGroup(
                    id=2,
                    name="group_2",
                    legacy_id="group_2",
                    permissions=no_permissions,
                ),
            ]
        )

        await session.commit()


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


class TestComposeGroupsUpdate:
    async def test_ok(self, no_permissions, pg: AsyncEngine):
        async with AsyncSession(pg) as session:
            session.add_all(
                [
                    SQLGroup(
                        id=1,
                        name="group_1",
                        legacy_id="group_1",
                        permissions=no_permissions,
                    ),
                    SQLGroup(
                        id=2,
                        name="group_2",
                        legacy_id="group_2",
                        permissions=no_permissions,
                    ),
                ]
            )

            await session.commit()

        assert await compose_groups_update(pg, ["group_1", 2]) == {
            "groups": ["group_1", 2]
        }

    async def test_non_existent_groups(self, _group_one_and_two, pg: AsyncEngine):
        with pytest.raises(ResourceConflictError) as err:
            await compose_groups_update(pg, ["group_1", 2, "group_3", 4])

        assert "Non-existent groups: 'group_3', 4" in str(err.value)


class TestComposePrimaryGroupUpdate:
    async def test_ok(self, _group_one_and_two, mongo: Mongo, pg: AsyncEngine):
        """
        Test that the ``primary_group`` is set correctly when the user is a member of
        the group.
        """
        await mongo.users.insert_one({"_id": "bob", "groups": [1, "group_2"]})

        assert await compose_primary_group_update(mongo, pg, [], 1, "bob") == {
            "primary_group": 1
        }

    async def test_extra(self, _group_one_and_two, mongo: Mongo, pg: AsyncEngine):
        """
        Test that the ``primary_group`` is set correctly when the user is in the
        ``extra`` group id list, but is not a member.
        """
        await mongo.users.insert_one({"_id": "bob", "groups": [1]})

        assert await compose_primary_group_update(
            mongo,
            pg,
            [2],
            2,
            "bob",
        ) == {"primary_group": 2}

    async def test_non_existent_group(self, mongo: Mongo, pg: AsyncEngine):
        """
        Test that an exception is raised if the provided ``primary_group`` does not
        exist in Postgres.
        """
        await mongo.users.insert_one({"_id": "bob", "groups": [5]})

        with pytest.raises(ResourceConflictError) as err:
            await compose_primary_group_update(
                mongo,
                pg,
                [],
                5,
                "bob",
            )

        assert "Non-existent group: 5" in str(err.value)

    async def test_not_a_member(
        self, _group_one_and_two, mongo: Mongo, pg: AsyncEngine
    ):
        """
        Test that an exception is raised if the user is not a member of the provided
        ``primary_group``.
        """
        await mongo.users.insert_one({"_id": "bob", "groups": [1]})

        with pytest.raises(ResourceConflictError) as err:
            await compose_primary_group_update(
                mongo,
                pg,
                [],
                2,
                "bob",
            )

        assert "User is not member of primary group" in str(err.value)


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
async def test_validate_credentials(
    legacy: bool, user_id: str, password: str, result: bool, mongo: Mongo
):
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
    administrator: bool,
    elevate: bool,
    missing: bool,
    all_permissions,
    mongo: Mongo,
    no_permissions,
    snapshot,
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

    await update_keys(
        mongo,
        "bob",
        administrator,
        ["peasants", "kings"],
        all_permissions if elevate else no_permissions,
    )

    assert await mongo.keys.find_one() == snapshot
