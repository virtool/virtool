import asyncio
from asyncio import gather

import pytest

from syrupy.filters import props
from virtool_core.models.roles import AdministratorRole

from virtool.administrators.oas import UpdateUserRequest, UpdateAdministratorRoleRequest
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.errors import ResourceNotFoundError
from virtool.users.db import validate_credentials


@pytest.mark.parametrize("term", [None, "test_user", "missing-handle"])
@pytest.mark.parametrize("administrator", [True, False, None])
async def test_find_users(
    spawn_client,
    authorization_client,
    fake2,
    snapshot,
    data_layer,
    administrator,
    term,
):

    group_1 = await fake2.groups.create()
    group_2 = await fake2.groups.create()

    user_1, user_2, _ = await asyncio.gather(
        fake2.users.create(
            handle="test_user", groups=[group_1, group_2], primary_group=group_1
        ),
        fake2.users.create(),
        fake2.users.create(),
    )

    await authorization_client.add(
        AdministratorRoleAssignment(user_1.id, AdministratorRole.BASE),
        AdministratorRoleAssignment(user_2.id, AdministratorRole.FULL),
    )

    result = data_layer.administrators.find_users(
        {"page": 1, "per_page": 25}, term=term, administrator=administrator
    )

    assert await result == snapshot


@pytest.mark.parametrize("administrator", [True, False])
async def test_get_user(
    spawn_client, authorization_client, fake2, snapshot, data_layer, administrator
):
    group_1 = await fake2.groups.create()
    user_1 = await fake2.users.create(
        handle="test_user", groups=[group_1], primary_group=group_1
    )

    if administrator:
        await authorization_client.add(
            AdministratorRoleAssignment(user_1.id, AdministratorRole.BASE),
        )

    assert await data_layer.administrators.get_user(user_1.id) == snapshot


class TestUpdate:
    @pytest.mark.parametrize(
        "update",
        [
            UpdateUserRequest(force_reset=True),
            UpdateUserRequest(groups=["peasants", "kings"], primary_group="peasants"),
        ],
        ids=[
            "force_reset",
            "groups",
        ],
    )
    async def test(
        self,
        all_permissions,
        mongo,
        no_permissions,
        snapshot,
        static_time,
        update,
        data_layer,
        fake2,
    ):
        """
        Ensure updates are applied correctly.

        """

        user_1 = await fake2.users.create()

        await gather(
            mongo.groups.insert_many(
                [
                    {
                        "_id": "peasants",
                        "permissions": {**no_permissions, "create_sample": True},
                    },
                    {
                        "_id": "kings",
                        "permissions": {**no_permissions, "create_ref": True},
                    },
                ],
                session=None,
            ),
            mongo.users.update_one(
                {"_id": user_1.id}, {"$set": {"groups": ["peasants"]}}
            ),
        )

        assert await data_layer.administrators.update_user(
            user_1.id, update
        ) == snapshot(name="obj")
        assert await mongo.users.find_one() == snapshot(
            name="db", exclude=props("password")
        )

    async def test_password(self, fake2, mongo, snapshot, data_layer, static_time):
        """
        Test editing an existing user.

        """
        user_1 = await fake2.users.create()

        assert await data_layer.administrators.update_user(
            user_1.id, UpdateUserRequest(password="hello_world")
        ) == snapshot(name="obj")

        document = await mongo.users.find_one()

        assert document == snapshot(name="db", exclude=props("password"))

        # Ensure the newly set password validates.
        assert await validate_credentials(mongo, user_1.id, "hello_world")

    async def test_does_not_exist(self, data_layer):
        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.administrators.update_user(
                "user_id", UpdateUserRequest(administrator=False)
            )
            assert "User does not exist" == str(err)


@pytest.mark.parametrize("role", [None, AdministratorRole.BASE, AdministratorRole.FULL])
async def test_update_role(fake2, mongo, snapshot, data_layer, role, static_time):
    """
    Test changing the administrator role of a user.

    """
    user_1 = await fake2.users.create()

    assert await data_layer.administrators.update_role(
        user_1.id, UpdateAdministratorRoleRequest(role=role)
    ) == snapshot(name="obj")

    updated_user = await mongo.users.find_one()
    assert updated_user["administrator"] == (role == AdministratorRole.FULL)

    expected_list = [(user_1.id, role)] if role is not None else []

    assert (
        await data_layer.administrators._authorization_client.list_administrators()
        == expected_list
    )
