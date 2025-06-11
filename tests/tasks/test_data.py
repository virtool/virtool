from asyncio import wait_for

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy import SnapshotAssertion

from tests.fixtures.core import StaticTime
from virtool.jobs.tasks import JobsCleanTask
from virtool.redis import Redis
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.tasks.oas import UpdateTaskRequest
from virtool.tasks.sql import SQLTask


async def test_find(
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    tasks_data: TasksData,
    static_time: StaticTime,
):
    task_1 = SQLTask(
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

    task_2 = SQLTask(
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


async def test_get(
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time: StaticTime,
    tasks_data: TasksData,
):
    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=True,
                context={"user_id": "test_1"},
                count=40,
                created_at=static_time.datetime,
                file_size=1024,
                progress=100,
                step="download",
                type="clone_reference",
            ),
        )
        await session.commit()

    assert await tasks_data.get(1) == snapshot


@pytest.mark.parametrize(
    "update",
    [
        UpdateTaskRequest(step="two"),
        UpdateTaskRequest(step="three", progress=55),
        UpdateTaskRequest(progress=55),
        UpdateTaskRequest(error="failed_task"),
    ],
    ids=["step", "step_progress", "progress", "error"],
)
async def test_update(
    update: UpdateTaskRequest,
    pg: AsyncEngine,
    snapshot: SnapshotAssertion,
    static_time: StaticTime,
    tasks_data: TasksData,
):
    async with AsyncSession(pg) as session:
        session.add(
            SQLTask(
                id=1,
                complete=False,
                context={"user_id": "test_1"},
                created_at=static_time.datetime,
                progress=22,
                step="one",
                type="dummy_task",
            ),
        )
        await session.commit()

    assert await tasks_data.update(1, update) == snapshot(name="return_value")
    assert await tasks_data.get(1) == snapshot(name="pg")


async def test_add(
    pg: AsyncEngine,
    redis: Redis,
    snapshot: SnapshotAssertion,
    static_time: StaticTime,
    tasks_data: TasksData,
):
    """Test that the TasksClient can successfully publish a Pub/Sub message to the tasks Redis channel."""
    tasks_client = TasksClient(redis)

    await tasks_data.create(JobsCleanTask)

    task_id = await wait_for(tasks_client.pop(), timeout=3)

    assert task_id == 1

    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SQLTask).filter_by(id=1))
        ).scalar().to_dict() == snapshot
