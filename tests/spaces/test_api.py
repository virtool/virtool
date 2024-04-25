import pytest
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine
from virtool_core.models.roles import (
    SpaceRole,
    SpaceSampleRole,
    SpaceProjectRole,
    SpaceLabelRole,
)

from tests.fixtures.client import ClientSpawner
from virtool.authorization.client import get_authorization_client_from_app
from virtool.authorization.relationships import SpaceMembership, UserRoleAssignment
from virtool.fake.next import DataFaker
from virtool.flags import FlagName
from virtool.spaces.models import SQLSpace



async def test_list(
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    snapshot,
    static_time,
):
    client = await spawn_client(
        administrator=True, authenticated=True, flags=[FlagName.SPACES]
    )

    async with AsyncSession(pg) as session:
        session.add_all(
            [
                SQLSpace(
                    id=0,
                    name="Space 0",
                    description="",
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                ),
                SQLSpace(
                    id=1,
                    name="Space 1",
                    description="A testing space.",
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                ),
            ]
        )

        await session.commit()

    await get_authorization_client_from_app(client.app).add(
        SpaceMembership(client.user.id, 0, SpaceRole.OWNER),
        SpaceMembership(client.user.id, 1, SpaceRole.MEMBER),
        UserRoleAssignment(client.user.id, 0, SpaceSampleRole.EDITOR),
    )

    resp = await client.get("/spaces")

    assert resp.status == 200
    assert await resp.json() == snapshot



async def test_get(
    fake2: DataFaker,
    pg: AsyncEngine,
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(
        administrator=True, authenticated=True, flags=[FlagName.SPACES]
    )

    user = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SQLSpace(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
            )
        )

        await session.commit()

    await get_authorization_client_from_app(client.app).add(
        SpaceMembership(client.user.id, 0, SpaceRole.OWNER),
        UserRoleAssignment(client.user.id, 0, SpaceSampleRole.EDITOR),
        SpaceMembership(user.id, 0, SpaceRole.MEMBER),
        UserRoleAssignment(user.id, 0, SpaceProjectRole.MANAGER),
    )

    resp = await client.get("/spaces/0")

    assert resp.status == 200
    assert await resp.json() == snapshot



async def test_update(
    pg: AsyncEngine, spawn_client: ClientSpawner, snapshot, static_time
):
    client = await spawn_client(
        administrator=True, authenticated=True, flags=[FlagName.SPACES]
    )

    async with AsyncSession(pg) as session:
        session.add(
            SQLSpace(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
            )
        )

        await session.commit()

    resp = await client.patch(
        "/spaces/0", {"name": "New Name", "description": "New description"}
    )

    assert resp.status == 200
    assert await resp.json() == snapshot



async def test_list_space_members(
    fake2: DataFaker,
    pg: AsyncEngine,
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(
        administrator=True, authenticated=True, flags=[FlagName.SPACES]
    )

    user_1 = await fake2.users.create()
    user_2 = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SQLSpace(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
            )
        )

        await session.commit()

    await get_authorization_client_from_app(client.app).add(
        SpaceMembership(client.user.id, 0, SpaceRole.OWNER),
        SpaceMembership(user_1.id, 0, SpaceRole.MEMBER),
        SpaceMembership(user_2.id, 0, SpaceRole.MEMBER),
        UserRoleAssignment(user_1.id, 0, SpaceSampleRole.EDITOR),
    )

    resp = await client.get("/spaces/0/members")

    assert resp.status == 200
    assert await resp.json() == snapshot



async def test_update_member_roles(
    fake2: DataFaker,
    pg: AsyncEngine,
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(
        administrator=True, authenticated=True, flags=[FlagName.SPACES]
    )

    user = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SQLSpace(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
            )
        )

        await session.commit()

    await get_authorization_client_from_app(client.app).add(
        SpaceMembership(user.id, 0, SpaceRole.OWNER),
        UserRoleAssignment(user.id, 0, SpaceProjectRole.EDITOR),
    )

    resp = await client.patch(
        f"/spaces/0/members/{user.id}",
        {"role": "member", "label": SpaceLabelRole.MANAGER},
    )

    assert resp.status == 200
    assert await resp.json() == snapshot



async def test_remove_member(
    fake2: DataFaker,
    pg: AsyncEngine,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(
        administrator=True, authenticated=True, flags=[FlagName.SPACES]
    )

    user_1 = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SQLSpace(
                id=0,
                name="Space 0",
                description="",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
            )
        )

        await session.commit()

    await get_authorization_client_from_app(client.app).add(
        SpaceMembership("test", 0, SpaceRole.OWNER),
        SpaceMembership(user_1.id, 0, SpaceRole.MEMBER),
        UserRoleAssignment(user_1.id, 0, SpaceSampleRole.EDITOR),
    )

    resp = await client.delete(f"/spaces/0/members/{user_1.id}")

    assert resp.status == 204
    assert (
        await get_authorization_client_from_app(client.app).list_user_roles(
            user_1.id, 0
        )
        == []
    )
