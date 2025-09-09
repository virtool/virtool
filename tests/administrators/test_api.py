from datetime import timedelta
from http import HTTPStatus

import arrow
import pytest
from syrupy import SnapshotAssertion
from syrupy.matchers import path_type

from tests.fixtures.client import ClientSpawner
from virtool.authorization.client import (
    AuthorizationClient,
)
from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.models.roles import AdministratorRole
from virtool.mongo.core import Mongo
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.mongo import validate_credentials
from virtool.users.utils import check_password

_last_password_change_matcher = path_type({"last_password_change": (str,)})
"""
Use this to substitute the last_password_change field with a string in response
snapshots.
"""


async def test_get_roles(spawn_client: ClientSpawner, snapshot: SnapshotAssertion):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    resp = await client.get("/admin/roles")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


async def test_list_users(
    authorization_client: AuthorizationClient,
    spawn_client: ClientSpawner,
    fake: DataFaker,
    snapshot: SnapshotAssertion,
):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    user_1 = await fake.users.create()
    user_2 = await fake.users.create()

    await authorization_client.add(
        AdministratorRoleAssignment(user_1.id, AdministratorRole.BASE),
        AdministratorRoleAssignment(user_2.id, AdministratorRole.FULL),
    )

    resp = await client.get("/admin/users")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(
        matcher=path_type({".*last_password_change": (str,)}, regex=True),
    )


async def test_get_user(
    authorization_client: AuthorizationClient,
    fake: DataFaker,
    spawn_client: ClientSpawner,
    snapshot: SnapshotAssertion,
    static_time,
):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    user = await fake.users.create()

    await authorization_client.add(
        AdministratorRoleAssignment(user.id, AdministratorRole.BASE),
    )

    resp = await client.get(f"/admin/users/{user.id}")

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(matcher=_last_password_change_matcher)


@pytest.mark.parametrize("error", [None, "400_exists", "400_password", "400_reserved"])
async def test_create(
    error: str | None,
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    resp_is,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    """Test that a valid request results in a user document being properly inserted."""
    await mongo.users.create_index("handle", unique=True, sparse=True)

    client = await spawn_client(administrator=True, authenticated=True)

    user = await fake.users.create()

    await get_data_from_app(client.app).settings.update(
        UpdateSettingsRequest(minimum_password_length=8),
    )

    data = {"handle": "fred", "password": "hello_world", "force_reset": False}

    if error == "400_exists":
        data["handle"] = user.handle

    if error == "400_reserved":
        data["handle"] = "virtool"

    if error == "400_password":
        data["password"] = "foo"

    resp = await client.post("/admin/users", data)

    if error == "400_exists":
        await resp_is.bad_request(resp, "User already exists")
        return

    if error == "400_password":
        await resp_is.bad_request(
            resp,
            "Password does not meet minimum length requirement (8)",
        )
        return

    if error == "400_reserved":
        await resp_is.bad_request(resp, "Reserved user name: virtool")
        return

    assert resp.status == 201

    resp_json = await resp.json()

    assert resp_json == snapshot
    assert resp.headers["Location"] == snapshot(name="location")

    document = await mongo.users.find_one(resp_json["id"])
    password = document.pop("password")

    assert document == snapshot(name="db")
    assert check_password("hello_world", password)
    assert await data_layer.users.get(resp_json["id"]) == snapshot(name="data_layer")


@pytest.mark.parametrize(
    "role",
    [None, AdministratorRole.USERS, AdministratorRole.FULL],
)
async def test_update_admin_role(
    fake: DataFaker,
    spawn_client: ClientSpawner,
    snapshot: SnapshotAssertion,
    role: AdministratorRole,
):
    client = await spawn_client(
        administrator=True,
        authenticated=True,
    )

    user = await fake.users.create()

    resp = await client.put(f"/admin/users/{user.id}/role", {"role": role})

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot(matcher=_last_password_change_matcher)


class TestUpdateUser:
    async def test_force_reset(
        self,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        user = await fake.users.create()

        resp = await client.patch(f"/admin/users/{user.id}", {"force_reset": True})
        body = await resp.json()

        assert resp.status == HTTPStatus.OK
        assert body == snapshot(matcher=_last_password_change_matcher)
        assert body["force_reset"] is True

    async def test_groups(
        self,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
    ):
        """Test that the endpoint can handle several combos of group changes."""
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        group_1 = await fake.groups.create()
        group_2 = await fake.groups.create()

        user = await fake.users.create(groups=[group_1])

        resp = await client.patch(
            f"/admin/users/{user.id}",
            {"groups": [group_1.id, group_2.id]},
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(
            name="resp_1",
            matcher=_last_password_change_matcher,
        )

        resp = await client.patch(f"/admin/users/{user.id}", {"groups": [group_2.id]})

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(
            name="resp_2",
            matcher=_last_password_change_matcher,
        )

        resp = await client.patch(f"/admin/users/{user.id}", {"groups": []})

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot(
            name="resp_3",
            matcher=_last_password_change_matcher,
        )

    @pytest.mark.parametrize(
        "password",
        ["a_whole_new_password", "fail"],
    )
    async def test_password(
        self,
        mongo: Mongo,
        fake: DataFaker,
        snapshot: SnapshotAssertion,
        spawn_client: ClientSpawner,
        password,
    ):
        """Test that a password change leads to a successful credential validation with the
        new password.
        """
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        user = await fake.users.create()

        resp = await client.patch(
            f"/admin/users/{user.id}",
            {"password": password},
        )
        body = await resp.json()

        if resp.status == 400:
            assert body == snapshot()
            return

        assert resp.status == HTTPStatus.OK
        assert body == snapshot(matcher=_last_password_change_matcher)

        # We don't want this to ever happen.
        assert "password" not in body

        # Make sure last_password_change field was updated to a now-ish time.
        assert arrow.utcnow() - arrow.get(body["last_password_change"]) < timedelta(
            seconds=1,
        )

        assert await validate_credentials(mongo, user.id, "a_whole_new_password")

    @pytest.mark.parametrize("is_member", [True, False])
    async def test_primary_group(
        self,
        is_member: bool,
        fake: DataFaker,
        snapshot,
        spawn_client: ClientSpawner,
    ):
        """Test that the primary group can be changed.

        If the user is not a member of the new primary group, the request should fail.
        """
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        group = await fake.groups.create()
        user = await fake.users.create(groups=([group] if is_member else []))

        resp = await client.patch(
            f"/admin/users/{user.id}",
            {"primary_group": group.id},
        )
        assert resp.status == HTTPStatus.OK if is_member else 400
        assert await resp.json() == snapshot(matcher=_last_password_change_matcher)


class TestAdministratorRoles:
    """Make sure users can't do bad stuff when changing other users' administrator roles."""

    @pytest.mark.parametrize(
        "role",
        [AdministratorRole.BASE, AdministratorRole.USERS, AdministratorRole.FULL, None],
    )
    async def test_ok(
        self,
        role: AdministratorRole,
        fake: DataFaker,
        snapshot,
        spawn_client: ClientSpawner,
    ):
        """Test that an administrator can a non-administrator's role."""
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        user = await fake.users.create()

        resp = await client.put(f"/admin/users/{user.id}/role", {"role": role})
        body = await resp.json()

        assert body == snapshot(matcher=_last_password_change_matcher)
        assert resp.status == HTTPStatus.OK
        assert body["administrator_role"] == (role.value if role else None)
        assert await (await client.get(f"/admin/users/{user.id}")).json() == body

    async def test_self(self, spawn_client: ClientSpawner):
        """Test that a user can't change their own role."""
        client = await spawn_client(
            administrator=True,
            authenticated=True,
        )

        resp = await client.put(
            f"/admin/users/{client.user.id}/role",
            {"role": AdministratorRole.USERS},
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
        fake: DataFaker,
        spawn_client: ClientSpawner,
    ):
        """Test that an administrator with a lower role or non-administrator can't change a
        user's role.
        """
        client = await spawn_client(authenticated=True)

        await data_layer.users.set_administrator_role(client.user.id, role)

        user = await fake.users.create()

        resp = await client.put(
            f"/admin/users/{user.id}/role",
            {"role": AdministratorRole.BASE},
        )

        assert resp.status == 403
        assert await resp.json() == {
            "id": "forbidden",
            "message": "Requires administrative privilege",
        }
