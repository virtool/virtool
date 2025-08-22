from importlib import import_module
from pathlib import Path

import arrow
import pytest
from aiohttp import MultipartReader
from pyfixtures import FixtureScope
from structlog import get_logger

from virtool.config.cls import WorkflowConfig
from virtool.data.file import ChunkWriter
from virtool.workflow import hooks
from virtool.workflow.api.client import api_client
from virtool.workflow.pytest_plugin.data import WorkflowData
from virtool.workflow.runtime.config import RunConfig
from virtool.workflow.runtime.hook import Hook

import_module("virtool.workflow.data")


@pytest.fixture
def captured_uploads_path(tmpdir) -> Path:
    """File uploads to the testing API will be written here. Use this path to make
    assertions about the contents of uploaded files.
    """
    path = Path(tmpdir) / "captured_uploads"
    path.mkdir(exist_ok=True, parents=True)

    return path


@pytest.fixture
def clear_hooks():
    """Temporarily clear hooks for a test."""
    backups = {}

    try:
        for hook in vars(hooks).values():
            if isinstance(hook, Hook):
                backups[hook] = hook.callbacks
                hook.callbacks = []
        yield
    finally:
        for hook, callbacks in backups.items():
            hook.callbacks = callbacks


@pytest.fixture
async def scope(
    jobs_api_connection_string: str, work_path: Path, workflow_data: WorkflowData
):
    """The same fixture scope that is used when running workflows."""
    import_module("virtool.workflow.data")

    job = workflow_data.job

    async with api_client(jobs_api_connection_string, job.id, job.key) as api:
        async with FixtureScope() as scope:
            config = RunConfig(
                dev=False,
                jobs_api_connection_string=jobs_api_connection_string,
                mem=8,
                proc=2,
                work_path=work_path,
            )

            scope["_config"] = config
            scope["_api"] = api
            scope["_error"] = None
            scope["_job"] = job
            scope["_state"] = job.state
            scope["_step"] = job.stage
            scope["_workflow"] = job.workflow

            scope["logger"] = get_logger("workflow")
            scope["mem"] = config.mem
            scope["proc"] = config.proc
            scope["results"] = {}
            scope["work_path"] = work_path

            yield scope


@pytest.fixture
def work_path(tmp_path) -> Path:
    """A temporary ``work_path`` for testing workflows."""
    path = tmp_path / "work"
    path.mkdir()

    return path


@pytest.fixture
def workflow_config(
    jobs_api_connection_string: str, redis_connection_string: str, work_path: Path
) -> WorkflowConfig:
    return WorkflowConfig(
        dev=False,
        jobs_api_connection_string=jobs_api_connection_string,
        mem=4,
        proc=2,
        redis_connection_string=redis_connection_string,
        redis_list_name="jobs_pathoscope",
        sentry_dsn="",
        timeout=5,
        work_path=work_path,
    )


@pytest.fixture
def read_file_from_multipart(captured_uploads_path: Path):
    """Reads the file from a ``MultiPartReader`` and writes it to ``captured_uploads_path.

    Use this in testing API endpoints that accept file uploads.
    """

    async def func(name: str, multipart: MultipartReader):
        file = await multipart.next()

        size = 0

        file_path = captured_uploads_path / name
        async with ChunkWriter(file_path) as writer:
            while True:
                chunk = await file.read_chunk(1024 * 1024 * 10)

                if not chunk:
                    break

                await writer.write(chunk)
                size += len(chunk)

        return {
            "id": 1,
            "description": None,
            "name": name,
            "format": "unknown",
            "name_on_disk": f"1-{name}",
            "size": size,
            "uploaded_at": arrow.utcnow().naive,
        }

    return func
