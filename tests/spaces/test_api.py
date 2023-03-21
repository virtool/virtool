import pytest
from sqlalchemy.ext.asyncio import AsyncSession
from virtool_core.models.roles import (
    SpaceRole,
    SpaceSampleRole,
    SpaceProjectRole,
    SpaceLabelRole,
)

from virtool.authorization.relationships import (
    SpaceMembership,
    UserRoleAssignment,
)
from virtool.spaces.models import SpaceModel


@pytest.mark.apitest
async def test_list_spaces(spawn_client, fake2, snapshot, pg, static_time):
    client = await spawn_client(authorize=True, administrator=True)

    authorization_client = client.app["authorization"]

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SpaceModel(
                    id=0,
                    name="Space 0",
                    description="",
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    created_by="test",
                ),
                SpaceModel(
                    id=1,
                    name="Space 1",
                    description="",
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    created_by="foo",
                ),
            ]
        )

        await session.commit()

    await authorization_client.add(
        SpaceMembership("test", 0, SpaceRole.OWNER),
        SpaceMembership("test", 1, SpaceRole.MEMBER),
        UserRoleAssignment("test", 0, SpaceSampleRole.EDITOR),
    )

    resp = await client.get("/spaces")

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_get_space(spawn_client, fake2, snapshot, pg, static_time):
    client = await spawn_client(authorize=True, administrator=True)

    user = await fake2.users.create()

    authorization_client = client.app["authorization"]

    async with AsyncSession(pg) as session:
        session.add(
            SpaceModel(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                created_by="test",
            )
        )

        await session.commit()

    await authorization_client.add(
        SpaceMembership("test", 0, SpaceRole.OWNER),
        UserRoleAssignment("test", 0, SpaceSampleRole.EDITOR),
        SpaceMembership(user.id, 0, SpaceRole.MEMBER),
        UserRoleAssignment(user.id, 0, SpaceProjectRole.MANAGER),
    )

    resp = await client.get(f"/spaces/{0}")

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_update_space(spawn_client, fake2, snapshot, static_time, pg):
    client = await spawn_client(authorize=True, administrator=True)

    async with AsyncSession(pg) as session:
        session.add(
            SpaceModel(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                created_by="test",
            )
        )

        await session.commit()

    resp = await client.patch(
        f"/spaces/0", {"name": "New Name", "description": "New description"}
    )

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_list_space_members(spawn_client, fake2, snapshot, static_time, pg):
    client = await spawn_client(authorize=True, administrator=True)

    authorization_client = client.app["authorization"]

    user_1 = await fake2.users.create()

    user_2 = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SpaceModel(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                created_by="test",
            )
        )

        await session.commit()

    await authorization_client.add(
        SpaceMembership("test", 0, SpaceRole.OWNER),
        SpaceMembership(user_1.id, 0, SpaceRole.MEMBER),
        SpaceMembership(user_2.id, 0, SpaceRole.MEMBER),
        UserRoleAssignment(user_1.id, 0, SpaceSampleRole.EDITOR),
    )

    resp = await client.get(f"/spaces/0/members")

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_update_member_roles(spawn_client, fake2, snapshot, static_time, pg):
    client = await spawn_client(authorize=True, administrator=True)

    authorization_client = client.app["authorization"]

    user_1 = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SpaceModel(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                created_by="test",
            )
        )

        await session.commit()

    await authorization_client.add(
        SpaceMembership(user_1.id, 0, SpaceRole.OWNER),
        UserRoleAssignment(user_1.id, 0, SpaceProjectRole.EDITOR),
    )

    resp = await client.patch(
        f"/spaces/0/members/{user_1.id}",
        {"role": "member", "label": SpaceLabelRole.MANAGER},
    )

    assert resp.status == 200

    assert await resp.json() == snapshot


@pytest.mark.apitest
async def test_remove_space_member(spawn_client, fake2, snapshot, static_time, pg):
    client = await spawn_client(authorize=True, administrator=True)

    authorization_client = client.app["authorization"]

    user_1 = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SpaceModel(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                created_by="test",
            )
        )

        await session.commit()

    await authorization_client.add(
        SpaceMembership("test", 0, SpaceRole.OWNER),
        SpaceMembership(user_1.id, 0, SpaceRole.MEMBER),
        UserRoleAssignment(user_1.id, 0, SpaceSampleRole.EDITOR),
    )

    resp = await client.delete(f"/spaces/0/members/{user_1.id}")

    assert resp.status == 204

    assert await authorization_client.list_user_roles(user_1.id, 0) == []
