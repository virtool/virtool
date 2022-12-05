import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.messages.models import SQLInstanceMessage


@pytest.fixture()
async def insert_test_message(fake2, pg, static_time):

    async def insert(active=True):
        user = await fake2.users.create()

        async with AsyncSession(pg) as session:
            session.add(
                SQLInstanceMessage(
                    id=1,
                    active=active,
                    color="yellow",
                    message="This is a test message",
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    user=user.id,
                )
            )
            await session.commit()

    return insert


@pytest.mark.parametrize("error", [None, "404"])
async def test_get(
    error, spawn_client, insert_test_message, snapshot
):
    """
    Test that a ``GET /instance_message`` return the active instance message.

    """
    client = await spawn_client(authorize=True, administrator=True)

    if not error:
        await insert_test_message()

    resp = await client.get("/instance_message")

    if error:
        assert await resp.json() is None
        return

    assert resp.status == 200
    assert await resp.json() == snapshot


async def test_create(static_time, spawn_client, snapshot):
    """
    Test that a newly active instance message can be added
    to the database at ``PUT /instance_message``.

    """
    client = await spawn_client(authorize=True, administrator=True)

    resp = await client.put("/instance_message", {"color": "red", "message": "This is a new message"})

    assert resp.status == 200

    assert await resp.json() == snapshot


class TestUpdate:
    async def test_active(self, spawn_client, insert_test_message, snapshot):
        client = await spawn_client(authorize=True, administrator=True)


        await insert_test_message()

        resp = await client.patch("/instance_message", {"color": "grey", "message": "Change test message content"})

        assert resp.status == 200
        assert await resp.json() == snapshot

    async def test_not_found(self, spawn_client, snapshot):
        client = await spawn_client(authorize=True, administrator=True)

        resp = await client.patch("/instance_message", {"color": "grey", "message": "Change test message content"})

        assert resp.status == 404

    async def test_inactive(self, spawn_client, insert_test_message, resp_is, snapshot):
        client = await spawn_client(authorize=True, administrator=True)

        await insert_test_message(active=False)

        resp = await client.patch("/instance_message", {"color": "grey", "message": "Change test message content"})

        await resp_is.conflict(resp, "No active message set")

    async def test_deactivate(self, spawn_client, insert_test_message, snapshot):
        client = await spawn_client(authorize=True, administrator=True)

        await insert_test_message()

        resp = await client.patch("/instance_message", {"color": "grey", "message": "Change message", "active": False})

        assert await resp.json() == snapshot
