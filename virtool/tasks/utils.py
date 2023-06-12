import asyncio

from virtool_core.redis import connect, periodically_ping_redis

from virtool.pg.utils import connect_pg
from virtool.config import get_config_from_app
from virtool.dispatcher.client import DispatcherClient
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
        connect(config.redis_connection_string),
    )

    dispatcher_interface = DispatcherClient(redis)
    scheduler = get_scheduler_from_app(app)

    await scheduler.spawn(periodically_ping_redis(redis))
    await scheduler.spawn(dispatcher_interface.run())

    app.update(
        {
            "dispatcher_interface": dispatcher_interface,
            "pg": pg,
            "redis": redis,
        }
    )


async def startup_datalayer_for_spawner(app: App):
    app["tasks_datalayer"] = TasksData(app["pg"], TasksClient(app["redis"]))
