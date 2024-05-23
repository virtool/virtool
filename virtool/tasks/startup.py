"""AIOHTTP startup functions for the task spawner and runner services."""

import asyncio

from aiohttp.web_app import Application
from aiojobs.aiohttp import get_scheduler_from_app
from virtool_core.redis import Redis

from virtool.analyses.tasks import StoreNuvsFilesTask
from virtool.config import get_config_from_app
from virtool.hmm.tasks import HMMRefreshTask
from virtool.indexes.tasks import EnsureIndexFilesTask
from virtool.jobs.tasks import TimeoutJobsTask
from virtool.ml.tasks import SyncMLModelsTask
from virtool.pg.utils import connect_pg
from virtool.references.tasks import CleanReferencesTask, RefreshReferenceReleasesTask
from virtool.samples.tasks import (
    CompressSamplesTask,
    MoveSampleFilesTask,
    UpdateSampleWorkflowsTask,
)
from virtool.subtractions.tasks import (
    AddSubtractionFilesTask,
    CheckSubtractionsFASTATask,
)
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.tasks.spawner import TaskSpawnerService


async def startup_databases_for_spawner(app: Application):
    """Creates Redis and Postgres connections

    :param app: the app object

    """
    config = get_config_from_app(app)

    redis = Redis(config.redis_connection_string)

    pg, redis = await asyncio.gather(
        connect_pg(config.postgres_connection_string),
        redis.connect(),
    )

    app.update({"pg": pg, "redis": redis})


async def startup_datalayer_for_spawner(app: Application):
    """Creates the tasks datalayer and adds it to the app.

    :param app: the :class:`aiohttp.web.Application` object
    """
    app["tasks_datalayer"] = TasksData(app["pg"], TasksClient(app["redis"]))


async def startup_task_spawner(app: Application):
    """Starts the task spawner."""
    tasks = [
        (AddSubtractionFilesTask, 3600),
        (CleanReferencesTask, 3600),
        (CheckSubtractionsFASTATask, 3600),
        (CompressSamplesTask, 3600),
        (EnsureIndexFilesTask, 3600),
        (HMMRefreshTask, 600),
        (MoveSampleFilesTask, 3600),
        (RefreshReferenceReleasesTask, 600),
        (StoreNuvsFilesTask, 3600),
        (SyncMLModelsTask, 600),
        (TimeoutJobsTask, 3600),
        (UpdateSampleWorkflowsTask, 3600),
    ]

    await get_scheduler_from_app(app).spawn(
        TaskSpawnerService(app["pg"], app["tasks_datalayer"]).run(tasks),
    )
