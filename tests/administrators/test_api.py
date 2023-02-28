import pytest
from virtool_core.models.roles import AdministratorRole

from virtool.authorization.relationships import AdministratorRoleAssignment
from virtool.mongo.utils import get_one_field


@pytest.mark.apitest
async def test_list_administrators(spawn_client, fake2, snapshot):
    client = await spawn_client(authorize=True, administrator=True)

    user_1 = await fake2.users.create()

    user_2 = await fake2.users.create()

    authorization_client = client.app["authorization"]

    await authorization_client.add(
        AdministratorRoleAssignment(user_1.id, AdministratorRole.BASE),
        AdministratorRoleAssignment(user_2.id, AdministratorRole.FULL),
    )

    resp = await client.get("/administrators")

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_get_administrator(spawn_client, fake2, snapshot):
    client = await spawn_client(authorize=True, administrator=True)

    user = await fake2.users.create()

    authorization_client = client.app["authorization"]

    await authorization_client.add(
        AdministratorRoleAssignment(user.id, AdministratorRole.BASE),
    )

    resp = await client.get(f"/administrators/{user.id}")

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize(
    "role", [None, AdministratorRole.USERS, AdministratorRole.FULL]
)
async def test_create_administrator(spawn_client, fake2, snapshot, role, mongo):
    client = await spawn_client(authorize=True, administrator=True)

    user = await fake2.users.create()

    resp = await client.post("/administrators", {"user_id": user.id, "role": role})

    assert resp.status == 201

    if role == AdministratorRole.FULL:
        assert await get_one_field(mongo.users, "administrator", user.id) is True

    assert await resp.json() == snapshot


@pytest.mark.apitest
@pytest.mark.parametrize(
    "role", [AdministratorRole.USERS, AdministratorRole.FULL, AdministratorRole.BASE]
)
async def test_update_administrator(spawn_client, fake2, snapshot, role):
    client = await spawn_client(authorize=True, administrator=True)

    user = await fake2.users.create()

    authorization_client = client.app["authorization"]

    await authorization_client.add(
        AdministratorRoleAssignment(user.id, AdministratorRole.FULL),
    )

    resp = await client.patch(f"/administrators/{user.id}", {"role": role})

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_delete_administrator(spawn_client, fake2, snapshot, mongo):
    client = await spawn_client(authorize=True, administrator=True)

    user = await fake2.users.create()

    authorization_client = client.app["authorization"]

    await authorization_client.add(
        AdministratorRoleAssignment(user.id, AdministratorRole.BASE),
    )

    resp = await client.delete(f"/administrators/{user.id}")

    assert resp.status == 204

    assert await get_one_field(mongo.users, "administrator", user.id) is False

    assert await authorization_client.list_administrators() == []
