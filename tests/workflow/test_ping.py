import asyncio

import pytest
from structlog.testing import LogCapture

from virtool.config.cls import WorkflowConfig
from virtool.jobs.models import JobState
from virtool.workflow import Workflow
from virtool.workflow.errors import JobsAPIUnauthorizedError
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.pytest_plugin.utils import StaticTime
from virtool.workflow.runtime.events import Events
from virtool.workflow.runtime.ping import _ping_periodically
from virtool.workflow.runtime.run import start_runtime


class RejectingAPI:
    """An API client that rejects every ping the way an inactive job is rejected."""

    async def put_json(self, path: str, data: dict) -> dict:
        raise JobsAPIUnauthorizedError("Job is no longer active")


class TestRejectedPing:
    """Test how the ping task reacts when the jobs API rejects its ping."""

    async def test_cancels_running_workflow(self):
        """A rejected ping ends a workflow that is still running its steps."""
        events = Events()

        parent_task = asyncio.create_task(asyncio.sleep(10))

        await _ping_periodically(RejectingAPI(), 1, events, parent_task)

        assert events.cancelled.is_set()

        with pytest.raises(asyncio.CancelledError):
            await parent_task

    async def test_leaves_completed_workflow_alone(self):
        """A rejected ping does not disturb a workflow that has finished its steps.

        The workflow finishes the job itself, which makes the job terminal and its
        pings rejected. Cancelling here would interrupt the hooks that run after a
        successful workflow.
        """
        events = Events()
        events.completed.set()

        parent_task = asyncio.create_task(asyncio.sleep(0.1))

        await _ping_periodically(RejectingAPI(), 1, events, parent_task)

        assert not events.cancelled.is_set()

        await parent_task

        assert not parent_task.cancelled()


async def test_cancellation_from_ping(
    log: LogCapture,
    static_time: StaticTime,
    workflow_config: WorkflowConfig,
    workflow_data: WorkflowData,
):
    """Test that the runner exits with a cancelled status when its ping is rejected.

    A cancelled job is no longer active, so the jobs API rejects its ping. That
    rejection is how the runner learns that it should stop.
    """
    workflow_data.job.workflow = "pathoscope"

    wf = Workflow()

    @wf.step
    async def first():
        """Description of the first step."""
        await asyncio.sleep(10)

    @wf.step
    async def second():
        """Description of the second step."""
        await asyncio.sleep(10)

    runtime_task = asyncio.create_task(
        start_runtime(
            workflow_config,
            workflow_loader=lambda: wf,
        ),
    )

    await asyncio.sleep(3)

    workflow_data.job.state = JobState.CANCELLED

    await runtime_task

    assert [update["id"] for update in workflow_data.step_start_updates] == ["first"]

    assert log.has("job is no longer active", level="info")
