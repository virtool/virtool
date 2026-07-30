"""Fixtures for creating test clients that can be used to test API endpoints."""

from pathlib import Path
from typing import Protocol

import arrow
import pytest
from aiohttp import BasicAuth
from aiohttp.test_utils import TestClient
from aiohttp.web import RouteTableDef
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.jobs.main
import virtool.tasks.main
from virtool.config.cls import ServerConfig, TaskRunnerConfig
from virtool.flags import FeatureFlags, FlagName
from virtool.jobs.pg import SQLJob
from virtool.users.pg import SQLUser
from virtool.utils import hash_key


class JobClientSpawner(Protocol):
    """A protocol the describes a function that can spawn a test job client.

    The fixture :func:`spawn_job_client` returns a function that conforms to this
    protocol.
    """

    async def __call__(
        self,
        add_route_table: RouteTableDef | None = None,
        auth: BasicAuth | None = None,
        authenticated: bool = False,
        dev: bool = False,
        flags: list[FlagName] | None = None,
    ) -> TestClient:
        """Spawn a test job client.

        :param add_route_table: a route table that will be added to the app
        :param authenticated: whether the client should be authenticated
        :param dev: whether the client should be in development mode
        :return: the test client
        """
        ...


@pytest.fixture
def spawn_job_client(
    aiohttp_client,
    tmp_path: Path,
    memory_storage,
    pg: AsyncEngine,
    pg_connection_string: str,
    mocker,
) -> JobClientSpawner:
    """A factory method for creating an aiohttp client which can authenticate with the
    API as a Job.
    """

    async def func(
        add_route_table: RouteTableDef = None,
        authenticated: bool = False,
        dev: bool = False,
        flags: list[FlagName] | None = None,
    ):
        if authenticated:
            key = "test_key"

            async with AsyncSession(pg) as session:
                test_user = SQLUser(
                    handle="test_job_user",
                    password=b"",
                    force_reset=False,
                    last_password_change=arrow.utcnow().naive,
                    settings={},
                )
                session.add(test_user)
                await session.flush()

                test_job = SQLJob(
                    acquired=True,
                    created_at=arrow.utcnow().naive,
                    key=hash_key(key),
                    state="running",
                    user_id=test_user.id,
                    workflow="nuvs",
                )
                session.add(test_job)
                await session.flush()
                job_id = test_job.id
                await session.commit()

            auth = BasicAuth(login=f"job-{job_id}", password=key)
        else:
            auth = None

        mocker.patch("virtool.startup.connect_pg", return_value=pg)
        mocker.patch(
            "virtool.startup.create_storage_backend",
            return_value=memory_storage,
        )

        app = await virtool.jobs.main.create_app(
            ServerConfig(
                dev=dev,
                flags=[],
                host="localhost",
                no_periodic_tasks=True,
                no_revision_check=True,
                port=9950,
                postgres_connection_string=pg_connection_string,
                sentry_dsn="",
                storage_backend="s3",
                storage_s3_bucket="test-bucket",
            ),
        )

        if add_route_table:
            app.add_routes(add_route_table)

        client = await aiohttp_client(app, auth=auth, auto_decompress=False)

        if flags:
            client.app["flags"] = FeatureFlags(flags)

        return client

    return func


class TaskRunnerClientSpawner(Protocol):
    """A protocol describing a function that spawns a task runner test client.

    The fixture :func:`spawn_task_runner_client` returns a function that conforms to
    this protocol.
    """

    async def __call__(self) -> TestClient:
        """Spawn a test client for the task runner app.

        :return: the test client
        """
        ...


@pytest.fixture
def spawn_task_runner_client(
    aiohttp_client,
    memory_storage,
    pg: AsyncEngine,
    pg_connection_string: str,
    mocker,
) -> TaskRunnerClientSpawner:
    """A factory method for creating an aiohttp client backed by the task runner app."""

    async def func():
        mocker.patch("virtool.startup.connect_pg", return_value=pg)
        mocker.patch(
            "virtool.startup.create_storage_backend",
            return_value=memory_storage,
        )

        app = await virtool.tasks.main.create_app(
            TaskRunnerConfig(
                host="localhost",
                no_revision_check=True,
                port=9950,
                postgres_connection_string=pg_connection_string,
                sentry_dsn="",
                storage_backend="s3",
                storage_s3_bucket="test-bucket",
            ),
        )

        return await aiohttp_client(app, auto_decompress=False)

    return func
