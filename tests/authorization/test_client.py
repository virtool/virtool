import asyncio

import pytest

from virtool.authorization.client import AuthorizationClient
from virtool.authorization.permissions import (
    Permission,
    ResourceType,
)
from virtool.authorization.relationships import (
    AdministratorRoleAssignment,
    SpaceMembership,
    SpaceRoleAssignment,
    UserRoleAssignment,
)
from virtool.models.roles import (
    AdministratorRole,
    SpaceProjectRole,
    SpaceRole,
    SpaceSampleRole,
    SpaceSubtractionRole,
)


class TestCheck:
    @pytest.mark.parametrize("has_permission", [True, False])
    async def test_member_permission(
        self,
        authorization_client: AuthorizationClient,
        has_permission,
    ):
        permission = (
            SpaceSubtractionRole.EDITOR
            if has_permission
            else SpaceSubtractionRole.VIEWER
        )

        await authorization_client.add(
            SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
            UserRoleAssignment("ryanf", 0, permission),
        )

        assert (
            await authorization_client.check(
                "ryanf", Permission.UPDATE_SUBTRACTION, ResourceType.SPACE, 0
            )
            is has_permission
        )

    async def test_base_role_permissions(
        self, authorization_client: AuthorizationClient
    ):
        await authorization_client.add(
            SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
            SpaceRoleAssignment(0, SpaceSubtractionRole.EDITOR),
            SpaceRoleAssignment(0, SpaceProjectRole.MANAGER),
        )

        results = await asyncio.gather(
            authorization_client.check(
                "ryanf", Permission.UPDATE_SUBTRACTION, ResourceType.SPACE, 0
            ),
            authorization_client.check(
                "ryanf", Permission.DELETE_PROJECT, ResourceType.SPACE, 0
            ),
        )

        assert all(results)


async def test_list_user_roles(authorization_client: AuthorizationClient):
    await authorization_client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        UserRoleAssignment("ryanf", 0, SpaceSubtractionRole.EDITOR),
        UserRoleAssignment("ryanf", 0, SpaceProjectRole.MANAGER),
    )

    assert await authorization_client.list_user_roles("ryanf", 0) == [
        "member",
        "project_manager",
        "subtraction_editor",
    ]


async def test_add_and_remove_user_roles(authorization_client: AuthorizationClient):
    await authorization_client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        UserRoleAssignment("ryanf", 0, SpaceSubtractionRole.EDITOR),
        UserRoleAssignment("ryanf", 0, SpaceProjectRole.MANAGER),
    )

    await authorization_client.remove(
        UserRoleAssignment("ryanf", 0, SpaceSubtractionRole.EDITOR)
    )

    assert await authorization_client.list_user_roles("ryanf", 0) == [
        "member",
        "project_manager",
    ]


async def test_list_administrators(authorization_client: AuthorizationClient):
    await authorization_client.add(
        AdministratorRoleAssignment("ryanf", AdministratorRole.BASE),
        AdministratorRoleAssignment("igboyes", AdministratorRole.FULL),
        AdministratorRoleAssignment("rhoffmann", AdministratorRole.FULL),
    )

    assert await authorization_client.list_administrators() == [
        ("igboyes", "full"),
        ("rhoffmann", "full"),
        ("ryanf", "base"),
    ]


async def test_add_idempotent(authorization_client: AuthorizationClient):
    """Ensure that adding a relationship that already exists does not raise an error and
    does not add a duplicate.
    """
    await authorization_client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        UserRoleAssignment("ryanf", 0, SpaceSubtractionRole.EDITOR),
    )

    assert await authorization_client.list_user_roles("ryanf", 0) == [
        "member",
        "subtraction_editor",
    ]

    await authorization_client.add(
        SpaceMembership("ryanf", 0, SpaceRole.MEMBER),
        UserRoleAssignment("ryanf", 0, SpaceSubtractionRole.EDITOR),
    )

    assert await authorization_client.list_user_roles("ryanf", 0) == [
        "member",
        "subtraction_editor",
    ]


async def test_exclusive(authorization_client: AuthorizationClient):
    await authorization_client.add(
        SpaceMembership("foo", 0, SpaceRole.OWNER),
        UserRoleAssignment("foo", 0, SpaceSampleRole.EDITOR),
    )

    await authorization_client.add(
        AdministratorRoleAssignment("test", AdministratorRole.BASE),
        AdministratorRoleAssignment("test", AdministratorRole.USERS),
        AdministratorRoleAssignment("test", AdministratorRole.FULL),
        SpaceMembership("foo", 0, SpaceRole.OWNER),
        SpaceMembership("foo", 0, SpaceRole.MEMBER),
        UserRoleAssignment("foo", 0, SpaceProjectRole.MANAGER),
    )

    assert await authorization_client.list_administrators() == [
        ("test", AdministratorRole.FULL)
    ]

    assert await authorization_client.list_user_roles("foo", 0) == [
        SpaceRole.MEMBER,
        SpaceProjectRole.MANAGER,
        SpaceSampleRole.EDITOR,
    ]
