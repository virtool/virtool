import pytest
from aiohttp.client import ClientSession, ClientTimeout

from tests.config.test_cls import build_server_config
from virtool.blast.task import BLASTSweepTask
from virtool.caches.tasks import LRUCacheEvictionTask
from virtool.hmm.tasks import HMMRefreshTask
from virtool.jobs.tasks import JobsTimeoutTask
from virtool.startup import (
    startup_http_client_session,
    startup_periodic_tasks,
    startup_storage,
)
from virtool.uploads.tasks import ReapOrphanedUploadsTask


@pytest.fixture
async def fake_app():
    version = "v1.2.3"

    app = {"version": version}

    yield app

    # Close real session created in `test_startup_executors()`.
    try:
        await app["client"].close()
    except (KeyError, TypeError):
        pass


async def test_startup_http_client(fake_app):
    await startup_http_client_session(fake_app)
    assert fake_app["version"] == "v1.2.3"
    assert isinstance(fake_app["client"], ClientSession)


async def test_startup_http_client_headers(mocker, fake_app):
    m = mocker.patch("virtool.startup.ClientSession")

    await startup_http_client_session(fake_app)

    expected_timeout = ClientTimeout(total=30, sock_connect=10, sock_read=10)
    m.assert_called_with(
        headers={"User-Agent": "virtool/v1.2.3"},
        timeout=expected_timeout,
    )


async def test_startup_storage(fake_app, mocker):
    fake_app["config"] = build_server_config()

    backend = mocker.Mock()
    mocker.patch(
        "virtool.startup.create_storage_backend",
        return_value=backend,
    )

    await startup_storage(fake_app)

    assert fake_app["storage"] is backend


class TestStartupPeriodicTasks:
    async def test_spawner_started(self, fake_app, mocker):
        fake_app["config"] = build_server_config(no_periodic_tasks=False)
        fake_app["data"] = mocker.Mock()

        spawner = mocker.patch("virtool.startup.PeriodicTaskSpawner").return_value
        spawner.run = mocker.AsyncMock()

        await startup_periodic_tasks(fake_app)

        await fake_app["background_tasks"][0]

        assert [task_class for task_class, _ in spawner.run.call_args.args[0]] == [
            BLASTSweepTask,
            HMMRefreshTask,
            JobsTimeoutTask,
            LRUCacheEvictionTask,
            ReapOrphanedUploadsTask,
        ]

    async def test_disabled(self, fake_app, mocker):
        fake_app["config"] = build_server_config(no_periodic_tasks=True)
        fake_app["data"] = mocker.Mock()

        spawner = mocker.patch("virtool.startup.PeriodicTaskSpawner")

        await startup_periodic_tasks(fake_app)

        spawner.assert_not_called()
        assert "background_tasks" not in fake_app
