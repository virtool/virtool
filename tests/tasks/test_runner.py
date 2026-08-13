import asyncio
from contextlib import suppress

from virtool.data.layer import DataLayer
from virtool.tasks.registry import get_task_from_name
from virtool.tasks.runner import TaskRunner


async def test_runner_picks_up_task(data_layer: DataLayer):
    """Test that TaskRunner can pick up a task created via TasksData."""
    runner = TaskRunner(data_layer)

    task = await data_layer.tasks.create(
        get_task_from_name("clone_reference"),
        {"user_id": "test_1"},
    )

    runner_task = asyncio.create_task(runner.run())

    await asyncio.sleep(0.5)  # Give more time for task to be picked up and start

    assert runner.current_task is not None
    assert runner.current_task.task_id == task.id
    assert runner.current_task.name == "clone_reference"

    # Cancel the runner task since CloneReferenceTask would run indefinitely
    runner_task.cancel()

    with suppress(asyncio.CancelledError):
        await runner_task

    # Since we cancelled while running, the task may not be complete
    # Just verify it was picked up correctly


async def test_runner_survives_acquire_failure(data_layer: DataLayer, mocker, log):
    """Keep polling after a failed acquisition.

    A runner that dies on a transient database error leaves the queue unattended
    until the next restart.
    """
    mocker.patch.object(
        data_layer.tasks,
        "acquire",
        side_effect=ConnectionResetError("connection reset"),
    )

    runner_task = asyncio.create_task(TaskRunner(data_layer).run())

    await asyncio.sleep(0.1)

    assert not runner_task.done()
    assert log.has("encountered error acquiring task", level="error")

    runner_task.cancel()

    with suppress(asyncio.CancelledError):
        await runner_task


async def test_runner_cancelled_while_acquiring(data_layer: DataLayer, mocker, log):
    """Reach the shutdown path when cancelled during an acquisition.

    ``CancelledError`` inherits from ``BaseException``, so the acquire handler does
    not intercept it.
    """

    async def acquire(runner_id, allowed_types):
        await asyncio.Event().wait()

    mocker.patch.object(data_layer.tasks, "acquire", side_effect=acquire)

    runner_task = asyncio.create_task(TaskRunner(data_layer).run())

    await asyncio.sleep(0.1)

    runner_task.cancel()

    with suppress(asyncio.CancelledError):
        await runner_task

    assert log.has("received stop signal", level="info")
    assert not log.has("encountered error acquiring task")


async def test_runner_marks_failed_task_errored(
    data_layer: DataLayer,
    mocker,
    log,
):
    """Mark an acquired task errored when it fails outside its own steps.

    ``acquire`` only returns unacquired rows, so a task left acquired after a
    failure would never be picked up again.
    """
    task = await data_layer.tasks.create(
        get_task_from_name("clone_reference"),
        {"user_id": "test_1"},
    )

    mocker.patch.object(
        TaskRunner,
        "_run_task",
        side_effect=ConnectionResetError("connection reset"),
    )

    runner_task = asyncio.create_task(TaskRunner(data_layer).run())

    await asyncio.sleep(0.1)

    runner_task.cancel()

    with suppress(asyncio.CancelledError):
        await runner_task

    assert log.has("encountered error running task", level="error", id=task.id)
    assert "connection reset" in (await data_layer.tasks.get(task.id)).error
