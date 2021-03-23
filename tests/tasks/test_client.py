from asyncio import wait_for

from aioredis import Redis

from virtool.tasks.client import TasksClient


async def test_client(loop, redis: Redis):
    """
    Test that the TasksClient can successfully publish a Pub/Sub message to the tasks Redis channel.

    """
    channel, = await redis.subscribe("channel:tasks")

    tasks_client = TasksClient(redis)

    await tasks_client.add(1)

    task_id = await wait_for(channel.get_json(), timeout=3)

    assert task_id == 1
