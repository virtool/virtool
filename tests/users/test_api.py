import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy import SnapshotAssertion
from virtool_core.models.enums import Permission
from virtool_core.models.roles import SpaceReferenceRole, SpaceSampleRole

from tests.fixtures.client import ClientSpawner
from tests.fixtures.core import StaticTime
from tests.fixtures.response import RespIs
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.relationships import UserRoleAssignment
from virtool.data.layer import DataLayer
from virtool.data.topg import both_transactions
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.groups.oas import GroupUpdateRequest, PermissionsUpdate
from virtool.mongo.core import Mongo
from virtool.settings.oas import SettingsUpdateRequest
from virtool.users.pg import SQLUser
from virtool.users.utils import check_password


@pytest.fixture()
async def setup_update_user(
    data_layer: DataLayer,
    fake: DataFaker,
    spawn_client: ClientSpawner,
):
    client = await spawn_client(administrator=True, authenticated=True)

    group_1 = await fake.groups.create()
    group_2 = await fake.groups.create()

    await data_layer.groups.update(
        group_1.id,
        GroupUpdateRequest(permissions=PermissionsUpdate(upload_file=True)),
    )

    await data_layer.groups.update(
        group_2.id,
        GroupUpdateRequest(
            permissions=PermissionsUpdate(create_sample=True, create_ref=True),
        ),
    )

    return client, group_1, group_2, await fake.users.create(groups=[group_1])


@pytest.mark.parametrize("find", [None, "fred"])
async def test_find(
    find: str | None,
    fake: DataFaker,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    """Test that a ``GET /users`` returns a list of users."""
    client = await spawn_client(
        administrator=True,
        authenticated=True,
        permissions=[Permission.create_sample],
    )

    await fake.users.create(handle=find)
    await fake.users.create()

    url = "/users"

    if find:
        url += f"?find={find}"

    resp = await client.get(url)

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize("status", [200, 404])
async def test_get(
    status: int,
    fake: DataFaker,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    """Test that a ``GET /users`` returns a list of users."""
    client = await spawn_client(administrator=True, authenticated=True)

    group = await fake.groups.create()

    user = await fake.users.create(
        groups=[group, await fake.groups.create()],
        primary_group=group,
    )

    await fake.users.create()

    resp = await client.get(f"/users/{'foo' if status == 404 else user.id}")

    assert resp.status == status
    assert await resp.json() == snapshot


@pytest.mark.parametrize("error", [None, "400_exists", "400_password", "400_reserved"])
async def test_create(
    error: str | None,
    data_layer: DataLayer,
    fake: DataFaker,
    mongo: Mongo,
    resp_is: RespIs,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time: StaticTime,
):
    """Test that a valid request results in a user document being properly inserted."""
    await mongo.users.create_index("handle", unique=True, sparse=True)

    client = await spawn_client(administrator=True, authenticated=True)

    user = await fake.users.create()

    await get_data_from_app(client.app).settings.update(
        SettingsUpdateRequest(minimum_password_length=8),
    )

    data = {"handle": "fred", "password": "hello_world", "force_reset": False}

    if error == "400_exists":
        data["handle"] = user.handle

    if error == "400_reserved":
        data["handle"] = "virtool"

    if error == "400_password":
        data["password"] = "foo"

    resp = await client.post("/users", data)

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


class TestUpdate:
    async def test_ok(
        self,
        setup_update_user,
        snapshot: SnapshotAssertion,
        static_time,
    ):
        client, group_1, _, user = setup_update_user

        resp = await client.patch(
            f"/users/{user.id}",
            data={
                "force_reset": True,
                "password": "hello_world",
                "primary_group": group_1.id,
            },
        )

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_with_groups(
        self,
        setup_update_user,
        snapshot: SnapshotAssertion,
        static_time,
    ):
        client, group_1, group_2, user = setup_update_user

        resp = await client.patch(
            f"/users/{user.id}",
            data={
                "password": "hello_world",
                "force_reset": True,
                "groups": [group_1.id, group_2.id],
            },
        )

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_short_password(self, setup_update_user, snapshot: SnapshotAssertion):
        client, _, _, user = setup_update_user

        resp = await client.patch(
            f"/users/{user.id}",
            data={
                "password": "cat",
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

    async def test_non_existent_primary_group(
        self,
        setup_update_user,
        snapshot: SnapshotAssertion,
    ):
        client, _, _, user = setup_update_user

        resp = await client.patch(
            f"/users/{user.id}",
            data={
                "primary_group": 4,
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

    async def test_not_a_member_of_primary_group(
        self,
        setup_update_user,
        snapshot: SnapshotAssertion,
    ):
        client, _, group_2, user = setup_update_user

        resp = await client.patch(
            f"/users/{user.id}",
            data={
                "primary_group": group_2.id,
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

    async def test_not_found(self, setup_update_user, snapshot: SnapshotAssertion):
        client, _, _, _ = setup_update_user

        resp = await client.patch(
            "/users/bob",
            data={
                "primary_group": 1,
            },
        )

        assert resp.status == 404
        assert await resp.json() == snapshot


@pytest.mark.parametrize("user", ["test", "bob"])
async def test_list_permissions(
    authorization_client: AuthorizationClient,
    spawn_client: ClientSpawner,
    user,
    snapshot: SnapshotAssertion,
):
    client = await spawn_client(
        authenticated=True,
        permissions=[Permission.create_sample, Permission.create_ref],
    )

    authorization_client = client.app["authorization"]

    await authorization_client.add(
        UserRoleAssignment("test", 0, SpaceSampleRole.EDITOR),
        UserRoleAssignment("test", 0, SpaceReferenceRole.BUILDER),
    )

    resp = await client.get(
        f"/users/{user}/permissions",
    )

    assert resp.status == 200
    assert await resp.json() == snapshot


@pytest.mark.parametrize(
    "role, status",
    [
        (SpaceSampleRole.MANAGER, 200),
        (None, 400),
    ],
    ids=["valid_permission", "invalid_permission"],
)
async def test_add_permission(
    role: SpaceSampleRole,
    status: int,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    client = await spawn_client(administrator=True, authenticated=True)
    if role is None:
        resp = await client.put("/users/test/permissions/invalid", {})
    else:
        resp = await client.put(f"/users/test/permissions/{role.value}", {})

    assert resp.status == status
    assert await resp.json() == snapshot()


@pytest.mark.parametrize(
    "role, status",
    [
        (SpaceSampleRole.MANAGER, 200),
        (None, 400),
    ],
    ids=["valid_permission", "invalid_permission"],
)
async def test_remove_permission(
    role: SpaceSampleRole,
    status: int,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
):
    client = await spawn_client(administrator=True, authenticated=True)

    if role is None:
        resp = await client.put("/users/test/permissions/invalid", {})
    else:
        resp = await client.put(f"/users/test/permissions/{role.value}", {})

    assert resp.status == status
    assert await resp.json() == snapshot()


@pytest.mark.parametrize("first_user_exists, status", [(True, 409), (False, 201)])
async def test_create_first_user(
    first_user_exists: bool,
    status: int,
    mongo: Mongo,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    spawn_client: ClientSpawner,
    static_time,
):
    """Checks response when first user exists and does not exist."""
    client = await spawn_client()

    if not first_user_exists:
        async with both_transactions(mongo, pg) as (mongo_session, pg_session):
            await pg_session.execute(delete(SQLUser))
            await mongo.users.delete_many({}, session=mongo_session)

    resp = await client.put(
        "/users/first",
        {"handle": "fred", "password": "hello_world"},
    )

    assert resp.status == status
    assert await resp.json() == snapshot
