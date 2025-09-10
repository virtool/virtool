import asyncio

from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.data.domain import DataLayerDomain
from virtool.data.events import (
    EventPublisher,
    Operation,
    dangerously_clear_events,
    dangerously_get_event,
    emit,
    emits,
    listen_for_client_events,
)
from virtool.models.base import BaseModel


class Emitted(BaseModel):
    id: str = "test-id"
    name: str
    age: int


async def test_emits():
    """Test that the ``@emits`` decorator can derive the event name from the method
    name.
    """

    class Example(DataLayerDomain):
        name = "example"

        @emits(Operation.CREATE)
        async def implicit_name(self):
            return Emitted(name="Bill", age=10)

    dangerously_clear_events()

    example = Example()
    await example.implicit_name()

    event = await dangerously_get_event()

    assert event.data == Emitted(name="Bill", age=10)
    assert event.domain == "example"
    assert event.name == "implicit_name"
    assert event.operation == Operation.CREATE


async def test_emits_named():
    """Test that the ``@emits`` decorator can be used with an explicit name."""

    class Example(DataLayerDomain):
        name = "example"

        @emits(Operation.UPDATE, name="explicit")
        async def explicit_name(self):
            return Emitted(name="Liam", age=15)

    dangerously_clear_events()

    example = Example()
    await example.explicit_name()

    event = await dangerously_get_event()

    assert event.data == Emitted(name="Liam", age=15)
    assert event.domain == "example"
    assert event.name == "explicit"
    assert event.operation == Operation.UPDATE


async def test_publish_and_listen(
    pg: AsyncEngine,
    pg_connection_string: str,
):
    """Test that an event published with ``emit()`` can be received via Postgres
    NOTIFY/LISTEN.
    """
    dangerously_clear_events()

    received_event = None

    async def listen():
        nonlocal received_event
        async for event in listen_for_client_events(pg_connection_string):
            received_event = event
            break

    listen_task = asyncio.create_task(listen())

    # Give the listener time to connect and start listening before publishing.
    await asyncio.sleep(0.1)

    publisher_task = asyncio.create_task(EventPublisher(pg).run())

    emit(Emitted(name="Wilfred", age=72), "example", "publish", Operation.CREATE)

    await asyncio.wait_for(listen_task, timeout=5.0)

    assert received_event is not None
    assert received_event.domain == "example"
    assert received_event.resource_id == "test-id"
    assert received_event.operation == "create"

    publisher_task.cancel()

    try:
        await publisher_task
    except asyncio.CancelledError:
        pass
