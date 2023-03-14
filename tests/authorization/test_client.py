import asyncio

import pytest
from virtool_core.models.roles import (
    AdministratorRole,
    ReferenceRole,
    SpaceProjectRole,
    SpaceRole,
    SpaceSubtractionRole,
)

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.permissions import Permission, ResourceType
from virtool.authorization.relationships import (
    AdministratorRoleAssignment,
    ReferenceRoleAssignment,
    SpaceMembership,
    SpaceRoleAssignment,
    UserRoleAssignment,
)


@pytest.fixture()
def spawn_auth_client(authorization_client, create_user, mongo):
    async def func(
        permissions=None,
    ) -> AuthorizationClient:
        await mongo.users.insert_one(
            await create_user(
                user_id="test",
                permissions=permissions,
            )
        )

        return authorization_client

    return func


class TestCheck:
    @pytest.mark.parametrize("has_permission", [True, False])
    async def test_member_permission(
        self,
        has_permission,
        spawn_auth_client,
    ):
        client = await spawn_auth_client()

        permission = (
            SpaceSubtractionRole.EDITOR
            if has_permission
            else SpaceSubtractionRole.VIEWER
        )

        await client.add(
            SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
            UserRoleAssignment(0, "ryanf", permission),
        )

        assert (
            await client.check(
                "ryanf", Permission.UPDATE_SUBTRACTION, ResourceType.SPACE, 0
            )
            is has_permission
        )

    async def test_base_role_permissions(self, spawn_auth_client):
        client = await spawn_auth_client()

        await client.add(
            SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
            SpaceRoleAssignment(0, SpaceSubtractionRole.EDITOR),
            SpaceRoleAssignment(0, SpaceProjectRole.MANAGER),
        )

        results = await asyncio.gather(
            client.check("ryanf", Permission.UPDATE_SUBTRACTION, ResourceType.SPACE, 0),
            client.check("ryanf", Permission.DELETE_PROJECT, ResourceType.SPACE, 0),
        )

        assert all(results)


async def test_list_space_base_roles(spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        SpaceRoleAssignment(0, SpaceSubtractionRole.EDITOR),
        SpaceRoleAssignment(0, SpaceProjectRole.MANAGER),
    )

    assert await client.get_space_roles(0) == ["project_manager", "subtraction_editor"]


async def test_list_user_spaces(spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        SpaceMembership("ryanf", 2, SpaceRole.MEMBER),
        SpaceMembership("ryanf", 1, SpaceRole.MEMBER),
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
    )

    assert await client.list_user_spaces("ryanf") == [0, 1, 2]


async def test_list_user_roles(snapshot, spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        UserRoleAssignment(0, "ryanf", SpaceSubtractionRole.EDITOR),
        UserRoleAssignment(0, "ryanf", SpaceProjectRole.MANAGER),
    )

    assert await client.list_user_roles("ryanf", 0) == [
        "member",
        "project_manager",
        "subtraction_editor",
    ]


async def test_add_and_remove_user_roles(spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        UserRoleAssignment(0, "ryanf", SpaceSubtractionRole.EDITOR),
        UserRoleAssignment(0, "ryanf", SpaceProjectRole.MANAGER),
    )

    await client.remove(UserRoleAssignment(0, "ryanf", SpaceSubtractionRole.EDITOR))

    assert await client.list_user_roles("ryanf", 0) == ["member", "project_manager"]


async def test_list_administrators(spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        AdministratorRoleAssignment("ryanf", AdministratorRole.BASE),
        AdministratorRoleAssignment("igboyes", AdministratorRole.FULL),
        AdministratorRoleAssignment("rhoffmann", AdministratorRole.FULL),
    )

    assert await client.list_administrators() == [
        ("igboyes", "full"),
        ("rhoffmann", "full"),
        ("ryanf", "base"),
    ]


async def test_list_reference_users(spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        ReferenceRoleAssignment("new_ref", "ryanf", ReferenceRole.BUILDER),
        ReferenceRoleAssignment("new_ref", "igboyes", ReferenceRole.MANAGER),
    )

    assert await client.list_reference_users("new_ref") == [
        ("igboyes", "manager"),
        ("ryanf", "builder"),
    ]


async def test_add_idempotent(fake2, spawn_auth_client):
    """
    Ensure that adding a relationship that already exists does not raise an error and
    does not add a duplicate.
    """
    client = await spawn_auth_client()

    await client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        UserRoleAssignment(0, "ryanf", SpaceSubtractionRole.EDITOR),
    )

    assert await client.list_user_roles("ryanf", 0) == ["member", "subtraction_editor"]

    await client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        UserRoleAssignment(0, "ryanf", SpaceSubtractionRole.EDITOR),
    )

    assert await client.list_user_roles("ryanf", 0) == ["member", "subtraction_editor"]
