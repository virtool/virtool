import asyncio

from structlog.testing import LogCapture

from virtool.config.cls import WorkflowConfig
from virtool.jobs.models import JobState
from virtool.workflow import Workflow
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.pytest_plugin.utils import StaticTime
from virtool.workflow.runtime.run import start_runtime


async def test_cancellation_from_ping(
    log: LogCapture,
    static_time: StaticTime,
    workflow_config: WorkflowConfig,
    workflow_data: WorkflowData,
):
    """Test that the runner exits with a cancelled status when the ping response
    indicates cancellation.
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

    assert log.has("received cancellation signal from ping response", level="info")
