import asyncio

from virtool_core.redis import connect as connect_redis, periodically_ping_redis

from virtool.pg.utils import connect_pg
from virtool.config import get_config_from_app
from virtool.startup import get_scheduler_from_app
from virtool.tasks.client import TasksClient
from virtool.tasks.data import TasksData
from virtool.types import App


async def startup_databases_for_spawner(app: App):
    """
    Creates Redis and Postgres connections

    :param app: the app object

    """
    config = get_config_from_app(app)

    pg, redis = await asyncio.gather(
        connect_pg(config.postgres_connection_string),
        connect_redis(config.redis_connection_string),
    )

    await get_scheduler_from_app(app).spawn(periodically_ping_redis(redis))

    app.update({"pg": pg, "redis": redis})


async def startup_datalayer_for_spawner(app: App):
    app["tasks_datalayer"] = TasksData(app["pg"], TasksClient(app["redis"]))
