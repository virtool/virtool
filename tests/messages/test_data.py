import pytest
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

from virtool.data.errors import ResourceNotFoundError
from virtool.messages.data import MessagesData
from virtool.messages.models import SQLInstanceMessage
from virtool.messages.oas import CreateMessageRequest, UpdateMessageRequest
from virtool.mongo.core import DB


@pytest.fixture
async def messages_data(pg: AsyncEngine, mongo: DB) -> MessagesData:
    return MessagesData(pg, mongo)


class TestGet:
    async def test_active(self, snapshot, static_time, messages_data, pg, fake2):

        user = await fake2.users.create()

        message_1 = SQLInstanceMessage(
            id=1,
            color="blue",
            message="This is test message 1",
            created_at=static_time.datetime,
            updated_at=static_time.datetime,
            user=user.id,
        )

        message_2 = SQLInstanceMessage(
            id=2,
            color="yellow",
            message="This is test message 2",
            created_at=static_time.datetime,
            updated_at=static_time.datetime,
            user=user.id
        )

        async with AsyncSession(pg) as session:
            session.add_all([message_1, message_2])
            await session.commit()

        assert await messages_data.get() == snapshot

    async def test_inactive(self, static_time, messages_data, pg):

        async with AsyncSession(pg) as session:
            session.add(
                SQLInstanceMessage(
                    id=1,
                    active=False,
                    color="grey",
                    message="This is a test message",
                    created_at=static_time.datetime,
                    updated_at=static_time.datetime,
                    user="test",
                )
            )
            await session.commit()

        with pytest.raises(ResourceNotFoundError):
            await messages_data.get()


async def test_create(snapshot, static_time, messages_data, fake2):

    user = await fake2.users.create()

    create_request = CreateMessageRequest(color="blue", message="This is a test message")

    await messages_data.create(create_request, user.id)

    assert await messages_data.get() == snapshot


async def test_update(snapshot, pg, static_time, messages_data, fake2):

    user = await fake2.users.create()

    async with AsyncSession(pg) as session:
        session.add(
            SQLInstanceMessage(
                id=1,
                color="yellow",
                message="This is a test message",
                created_at=static_time.datetime,
                updated_at=static_time.datetime,
                user=user.id,
            )
        )
        await session.commit()

    update_request = UpdateMessageRequest(color="red", message="Updated Message")

    await messages_data.update(update_request)

    assert await messages_data.get() == snapshot
