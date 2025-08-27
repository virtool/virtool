import asyncio
import time

import pytest
from pytest_structlog import StructuredLogCapture
from structlog.testing import LogCapture

from tests.fixtures.core import StaticTime
from virtool.config.cls import WorkflowConfig
from virtool.jobs.models import JobState, JobStatus
from virtool.redis import Redis
from virtool.workflow import Workflow
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.runtime.redis import CANCELLATION_CHANNEL
from virtool.workflow.runtime.run import start_runtime


async def wait_for_job_status(
    workflow_data: WorkflowData, expected_states: list, timeout: float = 10.0
):
    """Wait for job status to contain all expected states."""
    start_time = time.time()

    while time.time() - start_time < timeout:
        current_states = [update.state for update in workflow_data.job.status]
        if all(state in current_states for state in expected_states):
            return True
        await asyncio.sleep(0.1)

    return False


async def wait_for_job_progress(
    workflow_data: WorkflowData, min_progress: int, timeout: float = 10.0
):
    """Wait for job to reach at least the specified progress."""
    start_time = time.time()

    while time.time() - start_time < timeout:
        if workflow_data.job.status:
            latest_status = workflow_data.job.status[-1]
            if latest_status.progress >= min_progress:
                return True
        await asyncio.sleep(0.1)

    return False


async def wait_for_job_consumption(
    redis: Redis, list_name: str, job_id: str, timeout: float = 10.0
):
    """Wait for a job ID to be consumed from the Redis list."""
    start_time = time.time()

    while time.time() - start_time < timeout:
        # Check if job is still in the list
        jobs = await redis.lrange(list_name, 0, -1)
        if job_id not in jobs:
            return True
        await asyncio.sleep(0.1)

    return False


async def test_cancellation(
    log: LogCapture,
    redis: Redis,
    static_time: StaticTime,
    workflow_config: WorkflowConfig,
    workflow_data: WorkflowData,
):
    """Test that the runner exits with an appropriate status update if the job is cancelled."""
    workflow_data.job.workflow = "pathoscope"
    workflow_data.job.status = [
        JobStatus(
            progress=0,
            state=JobState.WAITING,
            timestamp=static_time.datetime,
        ),
    ]

    redis_list_name = "jobs_pathoscope"

    await redis.rpush(redis_list_name, workflow_data.job.id)

    wf = Workflow()

    @wf.step
    async def first():
        """Description of the first step."""
        await asyncio.sleep(2)

    @wf.step
    async def second():
        """Description of the second step."""
        await asyncio.sleep(3)

    @wf.step
    async def third():
        """Description of the third step."""
        await asyncio.sleep(4)

    @wf.step
    async def third():
        """Description of the fourth step."""
        await asyncio.sleep(5)

    runtime_task = asyncio.create_task(
        start_runtime(
            workflow_config,
            workflow_loader=lambda: wf,
        ),
    )

    await asyncio.sleep(5)

    await redis.publish(CANCELLATION_CHANNEL, workflow_data.job.id)

    await runtime_task

    state_and_progress = [
        (update.state, update.progress) for update in workflow_data.job.status
    ]

    assert state_and_progress[0] == (JobState.WAITING, 0)
    assert state_and_progress[1] == (JobState.PREPARING, 0)
    assert state_and_progress[2] == (JobState.RUNNING, 0)
    assert state_and_progress[-1] == (JobState.CANCELLED, state_and_progress[-2][1])

    assert log.has("received cancellation signal from redis", level="info")


async def test_timeout(
    log: StructuredLogCapture,
    workflow_config: WorkflowConfig,
):
    """Test that the runner exits if no job ID can be pulled from Redis before the timeout.

    This situation does not involve a status update being sent to the server.
    """
    wf = Workflow()

    @wf.step
    async def first():
        """Description of First."""
        await asyncio.sleep(1)

    @wf.step
    async def second():
        """Description of Second."""
        await asyncio.sleep(2)

    await start_runtime(
        workflow_config,
        workflow_loader=lambda: wf,
    )

    assert log.has("timed out while waiting for job id", level="warning")


@pytest.mark.timeout(30)
async def test_sigterm(
    jobs_api_connection_string: str,
    redis: Redis,
    redis_connection_string: str,
    static_time: StaticTime,
    workflow_config: WorkflowConfig,
    workflow_data: WorkflowData,
):
    workflow_data.job.workflow = "pathoscope"
    workflow_data.job.status = [
        JobStatus(
            progress=0,
            state=JobState.WAITING,
            timestamp=static_time.datetime,
        ),
    ]

    # Create a Python script to run the workflow in a subprocess
    script_content = f'''
import asyncio
from virtool.workflow import Workflow
from virtool.workflow.runtime.run import start_runtime
from virtool.config.cls import WorkflowConfig
from pathlib import Path

async def main():
    wf = Workflow()

    @wf.step
    async def first():
        """Description of First."""
        await asyncio.sleep(2)

    @wf.step
    async def second():
        """Description of Second."""
        await asyncio.sleep(5)

    await start_runtime(
        WorkflowConfig(
            dev=False,
            jobs_api_connection_string="{jobs_api_connection_string}",
            mem=4,
            proc=2,
            redis_connection_string="{redis_connection_string}",
            redis_list_name="jobs_pathoscope",
            sentry_dsn="",
            timeout=10,
            work_path=Path("{workflow_config.work_path}"),
        ),
        workflow_loader=lambda: wf,
    )

if __name__ == "__main__":
    asyncio.run(main())
'''

    # Write the script to a temporary file
    script_path = workflow_config.work_path / "workflow_script.py"
    script_path.write_text(script_content)

    # Start the subprocess
    proc = await asyncio.create_subprocess_exec(
        "python",
        str(script_path),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    await redis.rpush("jobs_pathoscope", workflow_data.job.id)

    # Wait for the job to be consumed from Redis (ensures workflow picked it up)
    await wait_for_job_consumption(redis, "jobs_pathoscope", workflow_data.job.id)

    # Wait for the job to start running, then give it time to start the first step
    await wait_for_job_status(workflow_data, [JobState.RUNNING])
    await asyncio.sleep(3)  # Terminate partway through the second step

    # Send SIGTERM to the process
    if proc.returncode is None:
        proc.terminate()
    else:
        # Process already completed - this helps diagnose timing issues in CI
        stdout, stderr = await proc.communicate()
        pytest.fail(
            f"Process completed before SIGTERM could be sent (returncode: {proc.returncode}). "
            f"Stdout: {stdout.decode()[:500]}... Stderr: {stderr.decode()[:500]}..."
        )

    # Wait for the process to exit
    try:
        await asyncio.wait_for(proc.wait(), timeout=5.0)
    except TimeoutError:
        # If it doesn't exit cleanly, force kill it
        proc.kill()
        await proc.wait()

    # Wait for the terminated status to be committed
    await wait_for_job_status(workflow_data, [JobState.TERMINATED])

    assert [(update.state, update.progress) for update in workflow_data.job.status] == [
        (JobState.WAITING, 0),
        (JobState.PREPARING, 0),
        (JobState.RUNNING, 0),
        (JobState.RUNNING, 50),
        (JobState.TERMINATED, 50),
    ]
