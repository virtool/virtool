import asyncio
import datetime
from datetime import datetime
from pprint import pprint

import pytest
from syrupy.matchers import path_type
from virtool_core.models.enums import Permission

from virtool.data.utils import get_data_from_app
from virtool.groups.oas import UpdateGroupRequest, UpdatePermissionsRequest
from virtool.settings.oas import UpdateSettingsRequest
from virtool.users.utils import check_password


@pytest.fixture
async def setup_update_user(fake2, spawn_client):
    client = await spawn_client(authorize=True, administrator=True)

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
            permissions=UpdatePermissionsRequest(create_sample=True, create_ref=True)
        ),
    )

    return client, group_1, group_2, await fake2.users.create(groups=[group_1])


@pytest.mark.apitest
@pytest.mark.parametrize("find", [None, "test"])
async def test_find(find, fake2, snapshot, spawn_client):
    """
    Test that a ``GET /users`` returns a list of users.

    """
    client = await spawn_client(
        authorize=True, administrator=True, permissions=[Permission.create_sample]
    )

    await fake2.users.create()
    await fake2.users.create()

    url = "/users"

    if find:
        url += f"?find={find}"

    resp = await client.get(url)

    assert resp.status == 200
    assert await resp.json() == snapshot(
        matcher=path_type(
            {
                "last_password_change": (datetime,),
            }
        )
    )


@pytest.mark.apitest
@pytest.mark.parametrize("status", [200, 404])
async def test_get(
    status,
    fake2,
    snapshot,
    spawn_client,
):
    """
    Test that a ``GET /users`` returns a list of users.

    """
    client = await spawn_client(authorize=True, administrator=True)

    group = await fake2.groups.create()

    user = await fake2.users.create(
        groups=[group, await fake2.groups.create()], primary_group=group
    )

    await fake2.users.create()

    resp = await client.get(f"/users/{'foo' if status == 404 else user.id}")

    assert resp.status == status
    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize("error", [None, "400_exists", "400_password", "400_reserved"])
async def test_create(error, fake2, snapshot, spawn_client, resp_is):
    """
    Test that a valid request results in a user document being properly inserted.

    """
    client = await spawn_client(authorize=True, administrator=True)

    data = {"handle": "fred", "password": "hello_world", "force_reset": False}

    user = await fake2.users.create()

    await get_data_from_app(client.app).settings.update(
        UpdateSettingsRequest(minimum_password_length=8)
    )

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
            resp, "Password does not meet minimum length requirement (8)"
        )
        return

    if error == "400_reserved":
        await resp_is.bad_request(resp, "Reserved user name: virtool")
        return

    assert resp.status == 201

    resp_json = await resp.json()

    assert resp_json == snapshot
    assert resp.headers["Location"] == snapshot(name="location")

    document = await client.db.users.find_one(resp_json["id"])
    password = document.pop("password")

    assert document == snapshot
    assert check_password("hello_world", password)


@pytest.mark.apitest
class TestUpdate:
    async def test(self, setup_update_user, snapshot):
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

    async def test_with_groups(self, setup_update_user, snapshot):
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

    async def test_short_password(self, setup_update_user, snapshot):
        client, _, _, user = setup_update_user

        resp = await client.patch(
            f"/users/{user.id}",
            data={
                "password": "cat",
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

    async def test_non_existent_primary_group(self, setup_update_user, snapshot):
        client, _, _, user = setup_update_user

        resp = await client.patch(
            f"/users/{user.id}",
            data={
                "primary_group": "managers",
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

    async def test_not_a_member_of_primary_group(self, setup_update_user, snapshot):
        client, _, group_2, user = setup_update_user

        resp = await client.patch(
            f"/users/{user.id}",
            data={
                "primary_group": group_2.id,
            },
        )

        assert resp.status == 400
        assert await resp.json() == snapshot

    async def test_not_found(self, setup_update_user, snapshot):
        client, _, _, _ = setup_update_user

        resp = await client.patch(
            f"/users/bob",
            data={
                "primary_group": "managers",
            },
        )

        assert resp.status == 404
        assert await resp.json() == snapshot
