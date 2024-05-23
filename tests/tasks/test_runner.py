import asyncio
from tempfile import TemporaryDirectory
from typing import Dict

import pytest

from virtool.tasks.client import TasksClient
from virtool.tasks.runner import TaskRunner
from virtool.tasks.task import BaseTask


class DummyTriggerTask(BaseTask):
    name = "dummy_trigger_task"

    def __init__(
        self,
        task_id: int,
        data: "DataLayer",
        context: Dict,
        temp_dir: TemporaryDirectory,
    ):
        super().__init__(task_id, data, context, temp_dir)
        self.done_flag = asyncio.Event()
        self.steps = [self.wait]

    async def wait(self):
        await self.done_flag.wait()

    def done(self):
        self.done_flag.set()


@pytest.fixture()
def task_runner(data_layer, redis):
    return TaskRunner(data_layer, TasksClient(redis))


async def test_run_task(
    task_runner,
    redis,
    data_layer,
    static_time,
    snapshot,
):
    task = await data_layer.tasks.create(DummyTriggerTask)

    assert await redis.lrange("tasks", 0, -1) == [1]

    task_runner_runtime = asyncio.create_task(task_runner.run())

    await asyncio.sleep(0.3)

    assert await redis.lrange("tasks", 0, -1) == []

    task_runner.current_task.done()

    retries = 0

    while True:
        try:
            assert await data_layer.tasks.get(task.id) == snapshot(name="complete_task")
            break
        except AssertionError:
            if retries >= 3:
                raise
            await asyncio.sleep(0.2)
            retries += 1

    task_runner_runtime.cancel()


@pytest.mark.parametrize("timeout", [0, 1])
async def test_graceful_shutdown(
    timeout,
    task_runner,
    redis,
    data_layer,
    static_time,
    snapshot,
):
    task = await data_layer.tasks.create(DummyTriggerTask)

    assert await redis.lrange("tasks", 0, -1) == [1]

    task_runner_runtime = asyncio.create_task(task_runner.run())

    await asyncio.sleep(0.3)
    assert await redis.lrange("tasks", 0, -1) == []

    task_runner_runtime.cancel()

    task_runner.current_task.done()
    await asyncio.sleep(timeout)
    task_runner_runtime.cancel()

    retries = 0

    while True:
        try:
            assert await data_layer.tasks.get(task.id) == snapshot(
                name=f"take timeout {timeout}s",
            )
            break
        except AssertionError:
            if retries >= 3:
                raise

            await asyncio.sleep(0.2)
            retries += 1
