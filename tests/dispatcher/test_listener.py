import json

from aioredis import Redis
from sqlalchemy.util import asyncio

from virtool.dispatcher.change import Change
from virtool.dispatcher.listener import RedisDispatcherListener
from virtool.dispatcher.operations import DELETE, UPDATE


async def test_listener(loop, redis: Redis):
    """
    Test that the Redis listener accepted all JSON-encoded changes and emits the expected
    :class:`Change` objects.

    """
    (channel,) = await redis.subscribe("channel:dispatch-test")

    listener = RedisDispatcherListener(channel)

    await asyncio.sleep(0.3)

    await redis.publish(
        "channel:dispatch-test",
        json.dumps({"interface": "samples", "operation": UPDATE, "id_list": [1, 3, 5]}),
    )

    await redis.publish(
        "channel:dispatch-test",
        json.dumps(
            {"interface": "analyses", "operation": DELETE, "id_list": [2, 1, 7]}
        ),
    )

    await asyncio.sleep(0.5)

    changes = list()

    async for change in listener:
        changes.append(change)

        if len(changes) == 2:
            break

    assert changes == [
        Change("samples", UPDATE, [1, 3, 5]),
        Change("analyses", DELETE, [2, 1, 7]),
    ]
