from pathlib import Path

import pytest
from aiohttp.test_utils import TestClient, TestServer
from aiohttp.web import Application

from tests.fixtures.workflow_api.analyses import create_analyses_routes
from tests.fixtures.workflow_api.hmms import create_hmms_routes
from tests.fixtures.workflow_api.indexes import create_indexes_routes
from tests.fixtures.workflow_api.jobs import create_jobs_routes
from tests.fixtures.workflow_api.ml import create_ml_routes
from tests.fixtures.workflow_api.samples import create_samples_routes
from tests.fixtures.workflow_api.subtractions import create_subtractions_routes
from tests.fixtures.workflow_api.uploads import create_uploads_routes
from virtool.workflow.pytest_plugin.data import WorkflowData


@pytest.fixture
async def api_server(
    aiohttp_server,
    example_path: Path,
    read_file_from_multipart,
    workflow_data: WorkflowData,
) -> TestServer:
    app = Application()

    for route in (
        create_analyses_routes(workflow_data, example_path, read_file_from_multipart),
        create_hmms_routes(workflow_data, example_path),
        create_indexes_routes(workflow_data, example_path, read_file_from_multipart),
        create_jobs_routes(workflow_data),
        create_ml_routes(workflow_data, example_path),
        create_samples_routes(workflow_data, example_path, read_file_from_multipart),
        create_subtractions_routes(
            workflow_data, example_path, read_file_from_multipart
        ),
        create_uploads_routes(workflow_data, example_path),
    ):
        app.add_routes(route)

    return await aiohttp_server(app)


@pytest.fixture
async def jobs_api_connection_string(api_server: TestServer) -> str:
    """The connection string for the mock API server."""
    return f"http://{api_server.host}:{api_server.port}"
