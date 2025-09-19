from http import HTTPStatus

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy.assertion import SnapshotAssertion

from tests.fixtures.client import ClientSpawner
from tests.fixtures.response import RespIs
from virtool.data.layer import DataLayer
from virtool.data.topg import both_transactions
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.groups.oas import PermissionsUpdate, UpdateGroupRequest
from virtool.models.enums import Permission
from virtool.mongo.core import Mongo
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.pg import SQLUser
from virtool.users.utils import check_password
from virtool.workflow.pytest_plugin.utils import StaticTime


@pytest.fixture
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
        UpdateGroupRequest(permissions=PermissionsUpdate(upload_file=True)),
    )

    await data_layer.groups.update(
        group_2.id,
        UpdateGroupRequest(
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

    assert resp.status == HTTPStatus.OK
    assert await resp.json() == snapshot


class TestGet:
    async def test_get(
        self,
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

        resp = await client.get(f"/users/{user.id}")

        assert resp.status == HTTPStatus.OK
        body = await resp.json()
        assert body == snapshot

        assert body["id"] == user.id
        assert len(body["groups"]) == 2

    async def test_not_found(self, spawn_client: ClientSpawner):
        """Test that a 404 is returned when the user does not exist."""
        client = await spawn_client(administrator=True, authenticated=True)

        resp = await client.get("/users/99")

        assert resp.status == HTTPStatus.NOT_FOUND


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
        UpdateSettingsRequest(minimum_password_length=8),
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

        assert resp.status == HTTPStatus.OK
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

        assert resp.status == HTTPStatus.OK
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
                "primary_group": 99,
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
