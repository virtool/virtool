import hashlib

import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.errors import ResourceConflictError
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.users.db import (
    compose_groups_update,
)
from virtool.users.mongo import (
    validate_credentials,
    compose_primary_group_update,
)
from virtool.users.utils import hash_password
from virtool.utils import random_alphanumeric


@pytest.fixture
async def _group_one_and_two(no_permissions: dict[str, bool], pg: AsyncEngine):
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


class TestComposeGroupsUpdate:
    async def test_ok(self, no_permissions: dict[str, bool], pg: AsyncEngine):
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

        assert await compose_groups_update(pg, ["group_1", 2], None) == {
            "groups": ["group_1", 2],
            "primary_group": None,
        }

    async def test_non_existent_groups(self, _group_one_and_two, pg: AsyncEngine):
        """Test that an exception is raised if one or more groups do not exist."""
        with pytest.raises(ResourceConflictError) as err:
            await compose_groups_update(pg, ["group_1", 2, "group_3", 4], None)

        assert "Non-existent groups: 'group_3', 4" in str(err.value)

    async def test_primary_group(self, _group_one_and_two, pg: AsyncEngine):
        """
        Test that the primary group id is set to `None` in the update if it is not
        included in the list of groups.
        """
        assert await compose_groups_update(pg, [1], 2) == {
            "groups": [1],
            "primary_group": None,
        }


class TestComposePrimaryGroupUpdate:
    async def test_ok(self, _group_one_and_two, mongo: Mongo, pg: AsyncEngine):
        """
        Test that the ``primary_group`` is set correctly when the user is a member of
        the group.
        """
        await mongo.users.insert_one({"_id": "bob", "groups": [1, "group_2"]})

        assert await compose_primary_group_update(
            mongo, pg, [1, "group_2"], 1, "bob"
        ) == {"primary_group": 1}

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
                [1],
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
