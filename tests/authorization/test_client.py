import pytest

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.permissions import (
    ResourceType,
)
from virtool.authorization.relationships import (
    SpaceUserRoleAssignment,
    SpaceMembership,
    AdministratorRoleAssignment,
    ReferenceUserRoleAssignment,
    SpaceBaseRoleAssignment,
)
from virtool.authorization.roles import (
    SpaceResourceRole,
    SpaceRole,
    SubtractionPermission,
    AdministratorRole,
    ReferenceRole,
    ProjectPermission,
)


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
    async def test_member_permission(
        self,
        has_permission,
        spawn_auth_client,
    ):
        client = await spawn_auth_client()

        permission = (
            SpaceResourceRole.SUBTRACTION_EDITOR
            if has_permission
            else SpaceResourceRole.SUBTRACTION_VIEWER
        )

        await client.add(
            SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
            SpaceUserRoleAssignment(0, "ryanf", permission),
        )

        assert (
            await client.check(
                "ryanf", SubtractionPermission.EDIT_SUBTRACTION, ResourceType.SPACE, 0
            )
            is has_permission
        )

    async def test_base_role_permissions(self, spawn_auth_client):

        client = await spawn_auth_client()

        await client.add(
            SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
            SpaceBaseRoleAssignment(0, SpaceResourceRole.SUBTRACTION_EDITOR),
            SpaceBaseRoleAssignment(0, SpaceResourceRole.PROJECT_MANAGER),
        )

        assert (
            await client.check(
                "ryanf", SubtractionPermission.EDIT_SUBTRACTION, ResourceType.SPACE, 0
            )
            is True
        )
        assert (
            await client.check(
                "ryanf", ProjectPermission.DELETE_PROJECT, ResourceType.SPACE, 0
            )
            is True
        )


async def test_list_space_base_roles(spawn_auth_client):
    client = await spawn_auth_client()

    await client.add(
        SpaceBaseRoleAssignment(0, SpaceResourceRole.SUBTRACTION_EDITOR),
        SpaceBaseRoleAssignment(0, SpaceResourceRole.PROJECT_MANAGER),
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
        SpaceUserRoleAssignment(0, "ryanf", SpaceResourceRole.SUBTRACTION_EDITOR),
        SpaceUserRoleAssignment(0, "ryanf", SpaceResourceRole.PROJECT_MANAGER),
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
        SpaceUserRoleAssignment(0, "ryanf", SpaceResourceRole.SUBTRACTION_EDITOR),
        SpaceUserRoleAssignment(0, "ryanf", SpaceResourceRole.PROJECT_MANAGER),
    )

    await client.remove(
        SpaceUserRoleAssignment(0, "ryanf", SpaceResourceRole.SUBTRACTION_EDITOR)
    )

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
        ReferenceUserRoleAssignment("new_ref", "ryanf", ReferenceRole.BUILDER),
        ReferenceUserRoleAssignment("new_ref", "igboyes", ReferenceRole.MANAGER),
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
        SpaceUserRoleAssignment(0, "ryanf", SpaceResourceRole.SUBTRACTION_EDITOR),
    )

    assert await client.list_user_roles("ryanf", 0) == ["member", "subtraction_editor"]

    await client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        SpaceUserRoleAssignment(0, "ryanf", SpaceResourceRole.SUBTRACTION_EDITOR),
    )

    assert await client.list_user_roles("ryanf", 0) == ["member", "subtraction_editor"]
