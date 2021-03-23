from asyncio import wait_for

from aioredis import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.subtractions.db import AddSubtractionFilesTask
from virtool.tasks.client import TasksClient
from virtool.tasks.models import Task


async def test_client(loop, redis: Redis, static_time, pg):
    """
    Test that the TasksClient can successfully publish a Pub/Sub message to the tasks Redis channel.

    """
    channel, = await redis.subscribe("channel:tasks")

    tasks_client = TasksClient(redis, pg)

    await tasks_client.add(AddSubtractionFilesTask)

    task_id = await wait_for(channel.get_json(), timeout=3)

    assert task_id == 1

    async with AsyncSession(pg) as session:
        row = (await session.execute(select(Task).filter_by(id=1))).scalar().to_dict()

    assert row == {
        'id': 1,
        'complete': False,
        'context': {},
        'count': 0,
        'created_at': static_time.datetime,
        'error': None,
        'file_size': None,
        'progress': 0,
        'step': None,
        'type': 'add_subtraction_files'
    }

