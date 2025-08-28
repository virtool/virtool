import asyncio
from pathlib import Path

import pytest
from structlog.testing import LogCapture

from tests.fixtures.core import StaticTime
from virtool.config.cls import WorkflowConfig
from virtool.jobs.models import JobState, JobStatus
from virtool.redis import Redis
from virtool.workflow import RunSubprocess, Workflow
from virtool.workflow.errors import SubprocessFailedError
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.runtime.redis import get_cancellation_channel
from virtool.workflow.runtime.run import start_runtime


@pytest.fixture
def bash(tmpdir) -> Path:
    sh = """
    echo "hello world"
    echo "foo bar"
    """

    path = Path(tmpdir / "test.sh")
    path.write_text(sh)

    return path


async def test_command_is_called(run_subprocess: RunSubprocess, tmpdir):
    """Test that the provided command is called."""
    path = tmpdir / "test.txt"
    assert not path.isfile()

    await run_subprocess(["touch", str(path)])

    assert path.isfile()


async def test_stdout_is_handled(bash: Path, run_subprocess: RunSubprocess):
    """Test that a function provided to ``stdout_handler`` is called with each line of
    stdout.
    """
    lines = []

    async def stdout_handler(line):
        lines.append(line)

    await run_subprocess(["bash", str(bash)], stdout_handler=stdout_handler)

    assert lines == [b"hello world\n", b"foo bar\n"]


async def test_stderr_is_handled(bash: Path, run_subprocess: RunSubprocess):
    """Test that a function provided to ``stderr_handler`` is called with each line of
    stderr.
    """
    lines = []

    async def stderr_handler(line):
        lines.append(line)

    with pytest.raises(SubprocessFailedError):
        await run_subprocess(["bash", "/foo/bar"], stderr_handler=stderr_handler)

    assert lines == [b"bash: /foo/bar: No such file or directory\n"]


async def test_subprocess_failed(run_subprocess: RunSubprocess):
    """Test that a ``SubprocessFailed`` error is raised when a command fails and is not
    raised when it succeeds.
    """
    with pytest.raises(SubprocessFailedError):
        await run_subprocess(["ls", "-doesnotexist"])

    await run_subprocess(["ls"])


@pytest.mark.timeout(45)
@pytest.mark.parametrize("cancel", [True, False])
async def test_terminated_by_cancellation(
    cancel: bool,
    jobs_api_connection_string: str,
    log: LogCapture,
    redis: Redis,
    redis_connection_string: str,
    static_time: StaticTime,
    tmp_path: Path,
    work_path: Path,
    workflow_data: WorkflowData,
):
    """Test that the runner exits with an appropriate status update if the job is cancelled."""
    test_txt_path = tmp_path / "test.txt"

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
    async def second(logger, run_subprocess: RunSubprocess, work_path: Path):
        """Description of the second step."""
        sh_path = work_path / "script.sh"
        sh_path.write_text(
            f"""
            sleep 10
            touch {test_txt_path!s}
            """,
        )

        logger.info("work path found", work_path=work_path)

        await run_subprocess(["bash", str(sh_path)])

        await asyncio.sleep(1)

    @wf.step
    async def third(work_path: Path):
        """Description of the third step."""
        await asyncio.sleep(5)

    runtime_task = asyncio.create_task(
        start_runtime(
            WorkflowConfig(
                dev=False,
                jobs_api_connection_string=jobs_api_connection_string,
                mem=4,
                proc=2,
                redis_connection_string=redis_connection_string,
                redis_list_name="jobs_pathoscope",
                sentry_dsn="",
                timeout=5,
                work_path=work_path,
            ),
            workflow_loader=lambda: wf,
        ),
    )

    await asyncio.sleep(4)

    if cancel:
        await redis.publish(get_cancellation_channel(redis), workflow_data.job.id)

    await runtime_task

    last_status = workflow_data.job.status[-1]

    # This file should not have been written if the job was cancelled!
    assert test_txt_path.is_file() is not cancel

    if cancel:
        assert last_status.state == JobState.CANCELLED
        assert log.has("received cancellation signal from redis", level="info")
    else:
        assert last_status.state == JobState.COMPLETE
