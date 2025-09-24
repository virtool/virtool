from http import HTTPStatus

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from tests.fixtures.client import ClientSpawner
from virtool.fake.next import DataFaker
from virtool.messages.sql import SQLInstanceMessage


@pytest.fixture
async def insert_test_message(fake: DataFaker, pg, static_time):
    async def insert(active=True):
        user = await fake.users.create()

        async with AsyncSession(pg) as session:
            session.add(
                SQLInstanceMessage(
                    id=1,
                    active=active,
                    color="yellow",
                    message="This is a test message",
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    user=str(user.id),
                ),
            )
            await session.commit()

    return insert


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error: str | None,
    insert_test_message,
    snapshot,
    spawn_client: ClientSpawner,
):
    """Test that a ``GET /instance_message`` return the active instance message."""
    client = await spawn_client(authenticated=True)

    if not error:
        await insert_test_message()

    resp = await client.get("/instance_message")

    if error is None:
        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot
    else:
        assert await resp.json() is None


async def test_create(snapshot, spawn_client: ClientSpawner, static_time):
    """Test that a newly active instance message can be added
    to the database at ``PUT /instance_message``.

    """
    client = await spawn_client(administrator=True, authenticated=True)

    resp = await client.put(
        "/instance_message",
        {"color": "red", "message": "This is a new message"},
    )

    assert resp.status == HTTPStatus.OK

    assert await resp.json() == snapshot


class TestUpdate:
    async def test_active(
        self,
        insert_test_message,
        snapshot,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(administrator=True, authenticated=True)

        await insert_test_message()

        resp = await client.patch(
            "/instance_message",
            {"color": "grey", "message": "Change test message content"},
        )

        assert resp.status == HTTPStatus.OK
        assert await resp.json() == snapshot

    async def test_not_found(self, spawn_client: ClientSpawner):
        client = await spawn_client(administrator=True, authenticated=True)

        resp = await client.patch(
            "/instance_message",
            {"color": "grey", "message": "Change test message content"},
        )

        assert resp.status == 404

    async def test_inactive(
        self,
        insert_test_message,
        resp_is,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(administrator=True, authenticated=True)

        await insert_test_message(active=False)

        resp = await client.patch(
            "/instance_message",
            {"color": "grey", "message": "Change test message content"},
        )

        await resp_is.conflict(resp, "No active message set")

    async def test_deactivate(
        self,
        insert_test_message,
        snapshot,
        spawn_client: ClientSpawner,
    ):
        client = await spawn_client(administrator=True, authenticated=True)

        await insert_test_message()

        resp = await client.patch(
            "/instance_message",
            {"color": "grey", "message": "Change message", "active": False},
        )

        assert await resp.json() == snapshot
