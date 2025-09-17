import asyncio

from virtool.data.layer import DataLayer
from virtool.references.tasks import CloneReferenceTask
from virtool.tasks.runner import TaskRunner


async def test_runner_picks_up_task(data_layer: DataLayer):
    """Test that TaskRunner can pick up a task created via TasksData."""
    runner = TaskRunner(data_layer)

    task = await data_layer.tasks.create(CloneReferenceTask, {"user_id": "test_1"})

    runner_task = asyncio.create_task(runner.run())

    await asyncio.sleep(0.5)  # Give more time for task to be picked up and start

    assert runner.current_task is not None
    assert runner.current_task.task_id == task.id
    assert runner.current_task.name == "clone_reference"

    # Cancel the runner task since CloneReferenceTask would run indefinitely
    runner_task.cancel()

    try:
        await runner_task
    except asyncio.CancelledError:
        pass

    # Since we cancelled while running, the task may not be complete
    # Just verify it was picked up correctly
