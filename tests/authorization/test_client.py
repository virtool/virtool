from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.models.roles import AdministratorRole


async def test_list_administrators(authorization_client: AuthorizationClient):
    await authorization_client.add(
        AdministratorRoleAssignment("ryanf", AdministratorRole.BASE),
        AdministratorRoleAssignment("igboyes", AdministratorRole.FULL),
        AdministratorRoleAssignment("rhoffmann", AdministratorRole.FULL),
    )

    assert await authorization_client.list_administrators() == [
        ("igboyes", AdministratorRole.FULL),
        ("rhoffmann", AdministratorRole.FULL),
        ("ryanf", AdministratorRole.BASE),
    ]


async def test_exclusive(authorization_client: AuthorizationClient):
    """Test that exclusive administrator roles work correctly."""
    await authorization_client.add(
        AdministratorRoleAssignment("test", AdministratorRole.BASE),
        AdministratorRoleAssignment("test", AdministratorRole.USERS),
        AdministratorRoleAssignment("test", AdministratorRole.FULL),
    )

    assert await authorization_client.list_administrators() == [
        ("test", AdministratorRole.FULL)
    ]
