import asyncio
from contextlib import suppress

from virtool.tasks.periodic import PeriodicTaskSpawner
from virtool.tasks.task import BaseTask


class SweepTask(BaseTask):
    name = "sweep_dummy"


class ReapTask(BaseTask):
    name = "reap_dummy"


class TestPeriodicTaskSpawner:
    async def test_spawns_each_task(self, mocker):
        """Attempt to spawn every configured task on each cycle."""
        tasks_datalayer = mocker.Mock()
        tasks_datalayer.create_periodic = mocker.AsyncMock(return_value=mocker.Mock())

        spawner = PeriodicTaskSpawner(tasks_datalayer)

        spawner_task = asyncio.create_task(
            spawner.run([(SweepTask, 30), (ReapTask, 600)]),
        )

        await asyncio.sleep(0.1)

        spawner_task.cancel()

        assert tasks_datalayer.create_periodic.call_args_list == [
            mocker.call(SweepTask, 30),
            mocker.call(ReapTask, 600),
        ]

    async def test_survives_spawn_failure(self, mocker, log):
        """Keep spawning after one task fails to spawn.

        The spawner is the only producer of periodic work, so it must outlive a
        transient database error instead of leaving the deployment without
        periodic tasks until the next restart.
        """

        async def create_periodic(task_class, interval):
            if task_class is SweepTask:
                raise ConnectionResetError("connection reset")

            return mocker.Mock()

        tasks_datalayer = mocker.Mock()
        tasks_datalayer.create_periodic = mocker.AsyncMock(side_effect=create_periodic)

        spawner = PeriodicTaskSpawner(tasks_datalayer)

        spawner_task = asyncio.create_task(
            spawner.run([(SweepTask, 30), (ReapTask, 600)]),
        )

        await asyncio.sleep(0.1)

        assert not spawner_task.done()

        spawner_task.cancel()

        assert log.has(
            "failed to spawn periodic task",
            level="error",
            name="sweep_dummy",
        )
        assert tasks_datalayer.create_periodic.call_args_list == [
            mocker.call(SweepTask, 30),
            mocker.call(ReapTask, 600),
        ]

    async def test_cancelled_while_spawning(self, mocker, log):
        """Reach the shutdown path when cancelled mid-spawn.

        ``CancelledError`` inherits from ``BaseException``, so the per-task handler
        does not intercept it.
        """

        async def create_periodic(task_class, interval):
            await asyncio.Event().wait()

        tasks_datalayer = mocker.Mock()
        tasks_datalayer.create_periodic = mocker.AsyncMock(side_effect=create_periodic)

        spawner = PeriodicTaskSpawner(tasks_datalayer)

        spawner_task = asyncio.create_task(spawner.run([(SweepTask, 30)]))

        await asyncio.sleep(0.1)

        spawner_task.cancel()

        with suppress(asyncio.CancelledError):
            await spawner_task

        assert log.has("stopped periodic task spawner", level="info")
        assert not log.has("failed to spawn periodic task")
