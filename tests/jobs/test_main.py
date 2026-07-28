from tests.config.test_cls import build_server_config
from virtool.app import create_app as create_api_app
from virtool.jobs.main import create_app
from virtool.shutdown import shutdown_scheduler
from virtool.startup import startup_periodic_tasks


class TestPeriodicTasks:
    """The jobs API server owns periodic task spawning.

    The public API server must not spawn periodic tasks so it can be scaled to
    zero without stalling the task queue.
    """

    async def test_spawned_by_jobs_server(self):
        app = await create_app(build_server_config())

        assert startup_periodic_tasks in app.on_startup

    async def test_not_spawned_by_api_server(self):
        app = create_api_app(build_server_config())

        assert startup_periodic_tasks not in app.on_startup


async def test_background_tasks_cancelled_on_shutdown():
    app = await create_app(build_server_config())

    assert shutdown_scheduler in app.on_shutdown
