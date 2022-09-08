from asyncio import wait_for

import pytest
from aioredis import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.subtractions.tasks import AddSubtractionFilesTask
from virtool.tasks.data import TasksData
from virtool.tasks.models import Task


@pytest.fixture
async def tasks_data(pg: AsyncEngine, redis: Redis) -> TasksData:
    return TasksData(pg, redis)


async def test_find(snapshot, spawn_client, pg: AsyncEngine, tasks_data: TasksData, static_time):
    task_1 = Task(
        id=1,
        complete=True,
        context={"user_id": "test_1"},
        count=40,
        created_at=static_time.datetime,
        file_size=1024,
        progress=100,
        step="download",
        type="clone_reference",
    )
    task_2 = Task(
        id=2,
        complete=False,
        context={"user_id": "test_2"},
        count=30,
        created_at=static_time.datetime,
        file_size=14754,
        progress=80,
        step="download",
        type="import_reference",
    )

    async with AsyncSession(pg) as session:
        session.add_all([task_1, task_2])
        await session.commit()

    assert await tasks_data.find() == snapshot


async def test_get(snapshot, spawn_client, pg: AsyncEngine, tasks_data: TasksData, static_time):
    async with AsyncSession(pg) as session:
        session.add(
            Task(
                id=1,
                complete=True,
                context={"user_id": "test_1"},
                count=40,
                created_at=static_time.datetime,
                file_size=1024,
                progress=100,
                step="download",
                type="clone_reference",
            )
        )
        await session.commit()

    assert await tasks_data.get(1) == snapshot


async def test_add(loop, snapshot, pg, redis: Redis, static_time, tasks_data: TasksData):
    """
    Test that the TasksClient can successfully publish a Pub/Sub message to the tasks Redis channel.

    """
    (channel,) = await redis.subscribe("channel:tasks")

    await tasks_data.add(AddSubtractionFilesTask)

    task_id = await wait_for(channel.get_json(), timeout=3)

    assert task_id == 1

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(Task).filter_by(id=1))
        ).scalar().to_dict() == snapshot