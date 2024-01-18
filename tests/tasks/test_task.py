import os
from asyncio import to_thread
from datetime import timedelta
from math import isclose
from tempfile import TemporaryDirectory
from typing import TYPE_CHECKING, Dict

import arrow
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.pg.utils import get_row_by_id
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.tasks.models import SQLTask
from virtool.tasks.spawner import TaskSpawnerService, PeriodicTask
from virtool.tasks.task import BaseTask
from virtool.utils import get_temp_dir

if TYPE_CHECKING:
    from virtool.data.layer import DataLayer


class DummyBaseTask(BaseTask):
    name = "dummmy_base_task"

    def __init__(self, task_id, data, context, temp_dir):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.step_one, self.step_two]

    async def step_one(self):
        ...

    async def step_two(self):
        ...


class DummyTask(BaseTask):
    name = "dummy_task"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)

        self.steps = [self.create_file, self.remove_file]

    async def create_file(self):
        with open(self.temp_path / "test.txt", "w") as f:
            f.write("This is a test file.")

    async def remove_file(self):
        await to_thread(os.remove, self.temp_path / "test.txt")


@pytest.fixture
async def task(data_layer, pg: AsyncEngine, static_time) -> DummyTask:
    task = SQLTask(
        id=1,
        complete=False,
        context={"user_id": "test"},
        count=0,
        created_at=static_time.datetime,
        progress=0,
        step="create_file",
        type="test_task",
    )

    async with AsyncSession(pg) as session:
        session.add(task)
        await session.commit()

    return await DummyTask.from_task_id(data_layer, 1)


async def test_base_task(data_layer, pg, static_time):
    task = SQLTask(
        id=1,
        complete=False,
        context={"user_id": "test"},
        count=0,
        created_at=static_time.datetime,
        progress=0,
        step="create_file",
        type="test_task",
    )

    async with AsyncSession(pg) as session:
        session.add(task)
        await session.commit()

    task = DummyBaseTask(1, data_layer, {}, get_temp_dir())

    await task.run()

    row: SQLTask = await get_row_by_id(pg, SQLTask, 1)

    assert row.id == 1
    assert row.complete is True
    assert row.progress == 100
    assert row.step == "step_two"


@pytest.mark.parametrize("error", [None, "error"])
async def test_run(error, task, pg: AsyncEngine):
    task.errored = error
    await task.run()

    async with AsyncSession(pg) as session:
        result = (
            (await session.execute(select(SQLTask).filter_by(id=task.task_id)))
            .scalar()
            .to_dict()
        )

    if error:
        assert result["progress"] == 0
    else:
        assert result["progress"] == 100
        assert not os.path.exists(task.temp_path)


@pytest.fixture
def test_channel():
    return "test-task-channel"


@pytest.fixture
def tasks_client(redis):
    return TasksClient(redis)


async def test_progress_handler_set_progress(task: BaseTask, pg: AsyncEngine):
    task.step = task.steps[0]
    tracker_1 = task.create_progress_handler()

    await tracker_1.set_progress(50)
    assert (await get_row_by_id(pg, SQLTask, 1)).progress == 25

    await tracker_1.set_progress(100)
    assert (await get_row_by_id(pg, SQLTask, 1)).progress == 50

    task.step = task.steps[1]
    tracker_2 = task.create_progress_handler()

    await tracker_2.set_progress(100)
    assert (await get_row_by_id(pg, SQLTask, 1)).progress == 100


async def test_progress_handler_set_error(task: BaseTask, pg: AsyncEngine):
    task.step = task.steps[0]
    tracker = task.create_progress_handler()

    await tracker.set_error("GenericError")
    assert (await get_row_by_id(pg, SQLTask, 1)).error == "GenericError"


async def test_register(pg: AsyncEngine, tasks_data: TasksData):
    await tasks_data.create(DummyBaseTask)
    await tasks_data.create(DummyTask)
    await tasks_data.create(DummyBaseTask)

    last_run_task = (await tasks_data.find())[0]

    task_spawner_service = TaskSpawnerService(pg, tasks_data)

    tasks = [(DummyBaseTask, 10), (DummyTask, 15)]

    await task_spawner_service.register(tasks)

    assert isclose(
        (
            (
                task_spawner_service.registered[0].last_triggered
                - last_run_task.created_at
            ).total_seconds()
        ),
        0,
        abs_tol=0.8,
    )


async def test_check_or_spawn_task(pg: AsyncEngine, tasks_data: TasksData):
    """
    First case tests that the task has spawned, second case ensures that it does not
    """
    task_spawner_service = TaskSpawnerService(pg, tasks_data)

    # This time should trigger a spawn as it is greater than the interval.
    long_last_triggered = (arrow.utcnow() - timedelta(seconds=180)).naive

    task_spawner_service.registered.append(
        PeriodicTask(DummyTask, interval=60, last_triggered=long_last_triggered)
    )

    spawned_task = await task_spawner_service.check_or_spawn_task(
        task_spawner_service.registered[0]
    )

    assert spawned_task.last_triggered != long_last_triggered

    # This time should prevent a task being spawned as it is less than the interval.
    short_last_triggered = (arrow.utcnow() - timedelta(seconds=20)).naive

    task_spawner_service.registered.append(
        PeriodicTask(DummyBaseTask, interval=60, last_triggered=short_last_triggered)
    )

    not_spawned_task = await task_spawner_service.check_or_spawn_task(
        task_spawner_service.registered[1]
    )

    assert not_spawned_task.last_triggered == short_last_triggered
