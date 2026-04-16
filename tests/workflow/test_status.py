import asyncio
from datetime import datetime

from structlog import get_logger
from syrupy import SnapshotAssertion
from syrupy.filters import props

from virtool.config.cls import WorkflowConfig
from virtool.jobs.models import (
    JobClaim,
    JobClaimed,
    JobState,
    JobStateV2,
    JobStatus,
    WorkflowV2,
)
from virtool.workflow import Workflow, hooks
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.runtime.events import Events
from virtool.workflow.runtime.run import run_workflow


def _make_claimed_job(workflow_data: WorkflowData) -> JobClaimed:
    """Build a JobClaimed object from workflow test data."""
    return JobClaimed(
        id=int(workflow_data.job.id),
        acquired=True,
        claim=JobClaim(
            runner_id="test-runner",
            mem=4.0,
            cpu=2.0,
            image="unknown",
            runtime_version="0.0.0",
            workflow_version="0.0.0",
        ),
        claimed_at=datetime.now(tz=None),
        created_at=workflow_data.job.created_at,
        key=workflow_data.job.key,
        state=JobStateV2.RUNNING,
        steps=[],
        user=workflow_data.job.user,
        workflow=WorkflowV2(workflow_data.job.workflow),
    )


async def test_ok(
    snapshot: SnapshotAssertion,
    workflow_data: WorkflowData,
    workflow_config: WorkflowConfig,
):
    """Test that status is reported normally in a successful workflow run."""
    wf = Workflow()

    workflow_data.job.workflow = "pathoscope"
    workflow_data.job.status = [
        JobStatus(
            progress=0,
            state=JobState.PREPARING,
            timestamp=datetime.now(),
        ),
    ]

    @wf.step
    async def first():
        """Description of First."""
        assert workflow_data.job.status[-1].state == JobState.RUNNING
        assert workflow_data.job.status[-1].step_name == "First"
        assert workflow_data.job.status[-1].step_description == "Description of First."

        await asyncio.sleep(1)

    @wf.step
    async def second():
        """Description of Second."""
        assert workflow_data.job.status[-1].state == JobState.RUNNING
        assert workflow_data.job.status[-1].step_name == "Second"
        assert workflow_data.job.status[-1].step_description == "Description of Second."

        await asyncio.sleep(2)

    on_success_called = False

    @hooks.on_success(once=True)
    async def check_success_status():
        nonlocal on_success_called
        on_success_called = True

        # Wait for status to be received at Virtool server
        await asyncio.sleep(0.1)

        assert workflow_data.job.status[-1].state == JobState.COMPLETE

    await run_workflow(
        workflow_config,
        _make_claimed_job(workflow_data),
        wf,
        Events(),
        get_logger("test"),
    )

    assert on_success_called is True

    assert [s.dict() for s in workflow_data.job.status] == snapshot(
        name="status",
        exclude=props("timestamp"),
    )


async def test_error(
    snapshot: SnapshotAssertion,
    workflow_config: WorkflowConfig,
    workflow_data: WorkflowData,
):
    """Test that an error raised in workflow step is reported."""
    workflow_data.job.workflow = "pathoscope"
    workflow_data.job.status = [
        JobStatus(
            progress=0,
            state=JobState.PREPARING,
            timestamp=datetime.now(),
        ),
    ]

    wf = Workflow()

    error = ValueError()

    @wf.step
    def raise_error():
        """Raise and error for testing purposes."""
        raise error

    error_hook_called = False

    @hooks.on_error(once=True)
    async def check_error_update_sent():
        nonlocal error_hook_called

        # Wait for status to be received at Virtool server.
        await asyncio.sleep(0.1)

        last_status = workflow_data.job.status[-1]

        assert last_status.state == JobState.ERROR
        assert last_status.error.type == "ValueError"

        error_hook_called = True

    failure_hook_called = False

    @hooks.on_failure(once=True)
    async def check_failure_hook_called():
        nonlocal failure_hook_called
        failure_hook_called = True

    await run_workflow(
        workflow_config,
        _make_claimed_job(workflow_data),
        wf,
        Events(),
        get_logger("test"),
    )

    assert error_hook_called is True
    assert failure_hook_called is True

    assert [s.dict() for s in workflow_data.job.status] == snapshot(
        name="status",
        exclude=props("timestamp", "traceback"),
    )
