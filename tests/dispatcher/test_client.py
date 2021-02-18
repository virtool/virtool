from asyncio import wait_for

from aiojobs import create_scheduler
from aioredis import Redis

from virtool.dispatcher.client import RedisDispatcherClient


async def test_client(loop, redis: Redis):
    """
    Test that the client can successfully publish a Pub/Sub message to the dispatch Redis channel.

    """
    channel, = await redis.subscribe("channel:dispatch")

    interface = RedisDispatcherClient(redis)
    scheduler = await create_scheduler()
    await scheduler.spawn(interface.run())

    interface.enqueue_change("samples", "update", [1, 3, 4])

    change = await wait_for(channel.get_json(), timeout=3)

    assert change == {
        "interface": "samples",
        "operation": "update",
        "id_list": [1, 3, 4]
    }

    await scheduler.close()
