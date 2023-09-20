import pytest
from virtool_core.models.roles import AdministratorRole

from virtool.authorization.client import (
    AuthorizationClient,
)
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.groups.oas import UpdateGroupRequest, UpdatePermissionsRequest
from virtool.users.db import validate_credentials


@pytest.mark.apitest
async def test_get_roles(spawn_client, snapshot):
    client = await spawn_client(authorize=True, administrator=True)

    resp = await client.get("/admin/roles")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_list_users(
    authorization_client: AuthorizationClient,
    spawn_client,
    fake2,
    snapshot,
):
    client = await spawn_client(authorize=True, administrator=True)

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    await authorization_client.add(
        AdministratorRoleAssignment(user_1.id, AdministratorRole.BASE),
        AdministratorRoleAssignment(user_2.id, AdministratorRole.FULL),
    )

    resp = await client.get("/admin/users")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_get_user(
    authorization_client: AuthorizationClient,
    fake2: DataFaker,
    spawn_client,
    snapshot,
    static_time,
):
    client = await spawn_client(authorize=True, administrator=True)

    user = await fake2.users.create()

    await authorization_client.add(
        AdministratorRoleAssignment(user.id, AdministratorRole.BASE),
    )

    resp = await client.get(f"/admin/users/{user.id}")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize(
    "role", [None, AdministratorRole.USERS, AdministratorRole.FULL]
)
async def test_update_admin_role(
    fake2: DataFaker, spawn_client, snapshot, role: AdministratorRole
):
    client = await spawn_client(authorize=True, administrator=True)

    user = await fake2.users.create()

    resp = await client.put(f"/admin/users/{user.id}/role", {"role": role})

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.fixture
def setup_admin_update_user(
    authorization_client: AuthorizationClient, fake2: DataFaker, spawn_client
):
    async def func(administrator):
        client = await spawn_client(authorize=True, administrator=administrator)

        if not administrator:
            await authorization_client.remove(
                *[
                    AdministratorRoleAssignment("test", role)
                    for role in AdministratorRole
                ]
            )

        group_1 = await fake2.groups.create()
        group_2 = await fake2.groups.create()

        groups = get_data_from_app(client.app).groups

        await groups.update(
            group_1.id,
            UpdateGroupRequest(permissions=UpdatePermissionsRequest(upload_file=True)),
        )

        await groups.update(
            group_2.id,
            UpdateGroupRequest(
                permissions=UpdatePermissionsRequest(
                    create_sample=True, create_ref=True
                )
            ),
        )

        user = await fake2.users.create(groups=[group_1])

        await authorization_client.remove(
            *[AdministratorRoleAssignment(user.id, role) for role in AdministratorRole]
        )
        return client, group_1, group_2, user

    return func


@pytest.mark.apitest
class TestUpdateUser:
    async def test(self, setup_admin_update_user, snapshot, mongo):
        client, group_1, _, user = await setup_admin_update_user(True)

        resp = await client.patch(
            f"/admin/users/{user.id}",
            data={
                "force_reset": True,
                "password": "hello_world",
                "primary_group": group_1.id,
            },
        )

        assert resp.status == 200
        assert await resp.json() == snapshot
        assert await validate_credentials(mongo, user.id, "hello_world")

    @pytest.mark.parametrize(
        "administrator, target_administrator, status",
        [
            (None, None, 403),
            (AdministratorRole.BASE, None, 403),
            (AdministratorRole.USERS, None, 200),
            (AdministratorRole.USERS, AdministratorRole.BASE, 403),
            (AdministratorRole.FULL, AdministratorRole.BASE, 200),
        ],
    )
    async def test_set_admin_roles(
        self,
        administrator: AdministratorRole | None,
        target_administrator: AdministratorRole | None,
        status: int,
        authorization_client: AuthorizationClient,
        setup_admin_update_user,
        snapshot,
    ):
        client, _, _, user = await setup_admin_update_user(False)

        if administrator is not None:
            await authorization_client.add(
                AdministratorRoleAssignment("test", administrator)
            )

        if target_administrator is not None:
            await authorization_client.add(
                AdministratorRoleAssignment(user.id, target_administrator)
            )

        resp = await client.patch(
            f"/admin/users/{user.id}",
            data={
                "force_reset": True,
            },
        )

        assert resp.status == status

        if status == 200:
            body = await resp.json()
            assert body["force_reset"] is True
            assert body == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("name,status", [("relist_jobs", 202), ("foo", 400)])
async def test_run_actions(name, status, spawn_client):
    client = await spawn_client(authorize=True, administrator=True)

    resp = await client.put("/admin/actions", {"name": name})

    assert resp.status == status
