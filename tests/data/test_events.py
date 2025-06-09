import asyncio

from redis import Redis

from virtool.data.domain import DataLayerDomain
from virtool.data.events import (
    EventPublisher,
    Operation,
    dangerously_clear_events,
    dangerously_get_event,
    emit,
    emits,
    listen_for_events,
)
from virtool.models.base import BaseModel


class Emitted(BaseModel):
    name: str
    age: int


async def test_emits():
    """Test that the ``@emits`` decorator can derive the event name from the method name."""

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


async def test_publish_and_listen(redis: Redis):
    """Test that an event published with ``emit()`` can be received by an
    ``EventListener``.
    """
    task = asyncio.create_task(EventPublisher(redis).run())

    emit(Emitted(name="Wilfred", age=72), "example", "publish", Operation.CREATE)

    async for event in listen_for_events(redis):
        assert event.data == Emitted(name="Wilfred", age=72)
        assert event.domain == "example"
        assert event.name == "publish"
        assert event.operation == Operation.CREATE

        break

    task.cancel()
    await task
