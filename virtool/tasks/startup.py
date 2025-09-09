import asyncio

from aiohttp.web_app import Application

from virtool.config import get_config_from_app
from virtool.hmm.tasks import HMMRefreshTask
from virtool.jobs.tasks import JobsTimeoutTask
from virtool.ml.tasks import MLModelsSyncTask
from virtool.pg.utils import connect_pg
from virtool.redis import Redis
from virtool.references.tasks import ReferenceReleasesRefreshTask, ReferencesCleanTask
from virtool.samples.tasks import (
    SampleWorkflowsUpdateTask,
)
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.tasks.spawner import TaskSpawnerService


async def startup_data_layer_for_spawner(app: Application) -> None:
    """Create the tasks datalayer and adds it to the app.

    :param app: the :class:`aiohttp.web.Application` object
    """
    app["tasks_datalayer"] = TasksData(app["pg"], TasksClient(app["redis"]))


async def startup_databases_for_spawner(app: Application) -> None:
    """Create Redis and Postgres connections.

    :param app: the app object
    """
    config = get_config_from_app(app)

    redis = Redis(config.redis_connection_string)

    pg, _ = await asyncio.gather(
        connect_pg(config.postgres_connection_string),
        redis.connect(),
    )

    app.update({"pg": pg, "redis": redis})


async def startup_task_spawner(app: Application) -> None:
    """Start the task spawner."""
    task = asyncio.create_task(
        TaskSpawnerService(app["pg"], app["tasks_datalayer"]).run(
            [
                (HMMRefreshTask, 600),
                (JobsTimeoutTask, 600),
                (MLModelsSyncTask, 600),
                (ReferenceReleasesRefreshTask, 600),
                (ReferencesCleanTask, 3600),
                (SampleWorkflowsUpdateTask, 3600),
            ]
        )
    )
    app.setdefault("background_tasks", []).append(task)
