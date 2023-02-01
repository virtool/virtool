import openfga_sdk
import pytest

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.permissions import (
    SpacePermission,
    ResourceType,
)
from virtool.authorization.relationships import (
    GroupMembership,
    UserPermission,
    GroupPermission,
)
from virtool.authorization.results import RemoveRelationshipResult


@pytest.fixture()
def spawn_auth_client(authorization_client, create_user, mongo):
    async def func(
        permissions=None,
    ) -> AuthorizationClient:
        await mongo.users.insert_one(
            create_user(
                user_id="test",
                permissions=permissions,
            )
        )

        return authorization_client

    return func


class TestCheck:
    @pytest.mark.parametrize("has_permission", [True, False])
    async def test_user_permission(
        self,
        has_permission,
        spawn_auth_client,
    ):
        client = await spawn_auth_client()

        permission = (
            SpacePermission.CANCEL_JOB
            if has_permission
            else SpacePermission.MODIFY_SUBTRACTION
        )

        await client.add(UserPermission("ryanf", permission))

        assert (
            await client.check(
                "ryanf", SpacePermission.CANCEL_JOB, ResourceType.SPACE, 0
            )
            is has_permission
        )

    @pytest.mark.parametrize("has_permission", [True, False])
    async def test_group_permission(
        self,
        has_permission,
        spawn_auth_client,
    ):
        client = await spawn_auth_client()

        permission = (
            SpacePermission.CANCEL_JOB
            if has_permission
            else SpacePermission.MODIFY_SUBTRACTION
        )

        await client.add(
            GroupMembership("ryanf", "sidney"), GroupPermission("sidney", permission)
        )

        assert (
            await client.check(
                "ryanf", SpacePermission.CANCEL_JOB, ResourceType.SPACE, 0
            )
            is has_permission
        )


async def test_list_groups(spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        GroupMembership("ryanf", "sidney"), GroupMembership("ryanf", "devs")
    )

    assert await client.list_groups("ryanf") == ["devs", "sidney"]


async def test_list_permissions(snapshot, spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        GroupMembership("ryanf", "sidney"), GroupMembership("ryanf", "devs")
    )

    await client.add(GroupPermission("sidney", SpacePermission.CANCEL_JOB))

    assert await client.list_permissions("ryanf", ResourceType.SPACE, 0) == [
        "cancel_job"
    ]


async def test_add_group_member(fake2, mongo, snapshot, spawn_auth_client):
    client: AuthorizationClient = await spawn_auth_client()

    await client.add(
        GroupMembership("ryanf", "sidney"), GroupMembership("ryanf", "students")
    )

    assert await client.list_groups("ryanf") == ["sidney", "students"]


async def test_remove_group_member(fake2, mongo, snapshot, spawn_auth_client):
    client: AuthorizationClient = await spawn_auth_client()

    await client.add(GroupMembership("ryanf", "sidney"))

    result = await client.remove(
        GroupMembership("ryanf", "sidney"), GroupMembership("ryanf", "devs")
    )

    assert result == RemoveRelationshipResult(not_found_count=1, removed_count=1)

    assert await client.list_groups("ryanf") == []


async def test_add_and_remove_group_permissions(fake2, spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(GroupMembership("ryanf", "sidney"))
    await client.add(
        GroupPermission("sidney", SpacePermission.CANCEL_JOB),
        GroupPermission("sidney", SpacePermission.MODIFY_SUBTRACTION),
    )

    assert await client.list_group_permissions("sidney", ResourceType.SPACE, 0) == [
        "cancel_job",
        "modify_subtraction",
    ]

    await client.remove(GroupPermission("sidney", SpacePermission.CANCEL_JOB))

    assert await client.list_group_permissions("sidney", ResourceType.SPACE, 0) == [
        "modify_subtraction",
    ]


async def test_add_and_remove_user_permissions(fake2, spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        UserPermission("ryanf", SpacePermission.CANCEL_JOB),
        UserPermission("ryanf", SpacePermission.MODIFY_SUBTRACTION),
        UserPermission("ryanf", SpacePermission.MODIFY_HMM),
    )

    assert await client.list_permissions(
        "ryanf", ResourceType.SPACE, 0
    ) == [
        "cancel_job",
        "modify_hmm",
        "modify_subtraction",
    ]


async def test_delete_group(fake2, spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        GroupPermission("sidney", SpacePermission.CANCEL_JOB),
        GroupPermission("sidney", SpacePermission.MODIFY_SUBTRACTION),
    )

    await client.delete_group("sidney")

    assert await client.list_group_permissions("sidney", ResourceType.SPACE, 0) == []


async def test_add_idempotent(fake2, spawn_auth_client):
    """
    Ensure that adding a relationship that already exists does not raise an error and
    does not add a duplicate.
    """
    client = await spawn_auth_client()

    await client.add(GroupMembership("ryanf", "sidney"))

    assert await client.list_groups("ryanf") == ["sidney"]

    await client.add(GroupMembership("ryanf", "sidney"))

    assert await client.list_groups("ryanf") == ["sidney"]
