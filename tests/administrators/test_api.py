from datetime import timedelta

import arrow
import pytest
from syrupy.matchers import path_type
from virtool_core.models.roles import AdministratorRole

from tests.fixtures.client import ClientSpawner
from virtool.authorization.client import (
    AuthorizationClient,
)
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.mongo.core import Mongo
from virtool.users.db import validate_credentials

_last_password_change_matcher = path_type({"last_password_change": (str,)})
"""
Use this to substitute the last_password_change field with a string in response
snapshots.
"""


@pytest.mark.apitest
async def test_get_roles(spawn_client: ClientSpawner, snapshot):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    resp = await client.get("/admin/roles")

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_list_users(
    authorization_client: AuthorizationClient,
    spawn_client: ClientSpawner,
    fake2: DataFaker,
    snapshot,
):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    await authorization_client.add(
        AdministratorRoleAssignment(user_1.id, AdministratorRole.BASE),
        AdministratorRoleAssignment(user_2.id, AdministratorRole.FULL),
    )

    resp = await client.get("/admin/users")

    assert resp.status == 200
    assert await resp.json() == snapshot(
        matcher=path_type({".*last_password_change": (str,)}, regex=True)
    )


@pytest.mark.apitest
async def test_get_user(
    authorization_client: AuthorizationClient,
    fake2: DataFaker,
    spawn_client: ClientSpawner,
    snapshot,
    static_time,
):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    user = await fake2.users.create()

    await authorization_client.add(
        AdministratorRoleAssignment(user.id, AdministratorRole.BASE),
    )

    resp = await client.get(f"/admin/users/{user.id}")

    assert resp.status == 200
    assert await resp.json() == snapshot(matcher=_last_password_change_matcher)


@pytest.mark.apitest
@pytest.mark.parametrize(
    "role", [None, AdministratorRole.USERS, AdministratorRole.FULL]
)
async def test_update_admin_role(
    fake2: DataFaker, spawn_client: ClientSpawner, snapshot, role: AdministratorRole
):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    user = await fake2.users.create()

    resp = await client.put(f"/admin/users/{user.id}/role", {"role": role})

    assert resp.status == 200
    assert await resp.json() == snapshot(matcher=_last_password_change_matcher)


@pytest.mark.apitest
class TestUpdateUser:
    async def test_force_reset(
        self, fake2: DataFaker, spawn_client: ClientSpawner, snapshot
    ):
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        user = await fake2.users.create()

        resp = await client.patch(f"/admin/users/{user.id}", {"force_reset": True})
        body = await resp.json()

        assert resp.status == 200
        assert body == snapshot(matcher=_last_password_change_matcher)
        assert body["force_reset"] is True

    async def test_groups(
        self, fake2: DataFaker, spawn_client: ClientSpawner, snapshot
    ):
        """Test that the endpoint can handle several combos of group changes."""
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        group_1 = await fake2.groups.create()
        group_2 = await fake2.groups.create()

        user = await fake2.users.create(groups=[group_1])

        resp = await client.patch(
            f"/admin/users/{user.id}", {"groups": [group_1.id, group_2.id]}
        )

        assert resp.status == 200
        assert await resp.json() == snapshot(
            name="resp_1", matcher=_last_password_change_matcher
        )

        resp = await client.patch(f"/admin/users/{user.id}", {"groups": [group_2.id]})

        assert resp.status == 200
        assert await resp.json() == snapshot(
            name="resp_2", matcher=_last_password_change_matcher
        )

        resp = await client.patch(f"/admin/users/{user.id}", {"groups": []})

        assert resp.status == 200
        assert await resp.json() == snapshot(
            name="resp_3", matcher=_last_password_change_matcher
        )

    async def test_password(
        self, mongo: Mongo, fake2: DataFaker, spawn_client: ClientSpawner, snapshot
    ):
        """
        Test that a password change leads to a successful credential validation with the
        new password.
        """
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        user = await fake2.users.create()

        resp = await client.patch(
            f"/admin/users/{user.id}", {"password": "a_whole_new_password"}
        )
        body = await resp.json()

        assert resp.status == 200
        assert body == snapshot(matcher=_last_password_change_matcher)

        # We don't want this to ever happen.
        assert "password" not in body

        # Make sure last_password_change field was updated to a now-ish time.
        assert arrow.utcnow() - arrow.get(body["last_password_change"]) < timedelta(
            seconds=1
        )

        assert await validate_credentials(mongo, user.id, "a_whole_new_password")

    @pytest.mark.parametrize("is_member", [True, False])
    async def test_primary_group(
        self, is_member: bool, fake2: DataFaker, spawn_client: ClientSpawner, snapshot
    ):
        """
        Test that the primary group can be changed.

        If the user is not a member of the new primary group, the request should fail.
        """
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        group = await fake2.groups.create()
        user = await fake2.users.create(groups=([group] if is_member else []))

        resp = await client.patch(
            f"/admin/users/{user.id}", {"primary_group": group.id}
        )

        assert resp.status == 200 if is_member else 400
        assert await resp.json() == snapshot(matcher=_last_password_change_matcher)


class TestAdministratorRoles:
    """
    Make sure users can't do bad stuff when changing other users' administrator roles.
    """

    @pytest.mark.parametrize(
        "role",
        [AdministratorRole.BASE, AdministratorRole.USERS, AdministratorRole.FULL, None],
    )
    async def test_ok(
        self,
        role: AdministratorRole,
        fake2: DataFaker,
        spawn_client: ClientSpawner,
        snapshot,
    ):
        """Test that an administrator can a non-administrator's role."""
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        user = await fake2.users.create()

        resp = await client.put(f"/admin/users/{user.id}/role", {"role": role})
        body = await resp.json()

        assert body == snapshot(matcher=_last_password_change_matcher)
        assert resp.status == 200
        assert body["administrator_role"] == (role.value if role else None)
        assert await (await client.get(f"/admin/users/{user.id}")).json() == body

    async def test_self(self, spawn_client: ClientSpawner):
        """Test that a user can't change their own role."""
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        resp = await client.put(
            f"/admin/users/{client.user.id}/role", {"role": AdministratorRole.USERS}
        )

        assert resp.status == 400
        assert await resp.json() == {
            "id": "bad_request",
            "message": "Cannot change own role",
        }

    @pytest.mark.parametrize(
        "role",
        [
            AdministratorRole.BASE,
            AdministratorRole.USERS,
            AdministratorRole.SETTINGS,
            AdministratorRole.SPACES,
            None,
        ],
    )
    async def test_insufficient_role(
        self,
        role: AdministratorRole,
        data_layer: DataLayer,
        fake2: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """
        Test that an administrator with a lower role or non-administrator can't change a
        user's role.
        """
        client = await spawn_client(authenticated=True)

        await data_layer.users.set_administrator_role(client.user.id, role)

        user = await fake2.users.create()

        resp = await client.put(
            f"/admin/users/{user.id}/role", {"role": AdministratorRole.BASE}
        )

        assert resp.status == 403
        assert await resp.json() == {
            "id": "forbidden",
            "message": "Requires administrative privilege",
        }


"""
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
"""


@pytest.mark.apitest
@pytest.mark.parametrize("name,status", [("relist_jobs", 202), ("foo", 400)])
async def test_run_actions(name: str, status: int, spawn_client: ClientSpawner):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    resp = await client.put("/admin/actions", {"name": name})

    assert resp.status == status
