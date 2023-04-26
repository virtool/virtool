import asyncio
import concurrent.futures
import logging
import sys
from dataclasses import dataclass
from typing import Dict

import aiohttp.client
import aiojobs
import aiojobs.aiohttp
import pymongo.errors
from msal import ClientApplication
from virtool_core.redis import connect, periodically_ping_redis
from virtool.mongo.connect import connect_mongo
from virtool.pg.utils import connect_pg
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.utils import connect_openfga
from virtool.config import get_config_from_app
from virtool.data.factory import create_data_layer
from virtool.data.utils import get_data_from_app
from virtool.dispatcher.client import DispatcherClient
from virtool.dispatcher.dispatcher import Dispatcher
from virtool.dispatcher.events import DispatcherSQLEvents
from virtool.dispatcher.listener import RedisDispatcherListener
from virtool.mongo.core import Mongo
from virtool.mongo.identifier import RandomIdProvider
from virtool.mongo.migrate import migrate
from virtool.oidc.utils import JWKArgs
from virtool.routes import setup_routes
from virtool.sentry import setup
from virtool.tasks.client import TasksClient
from virtool.tasks.runner import TaskRunner
from virtool.types import App
from virtool.version import determine_server_version

logger = logging.getLogger("startup")


@dataclass
class B2C:
    msal: ClientApplication
    authority: str
    jwk_args: JWKArgs = None
    auth_code_flow: dict = None


def get_scheduler_from_app(app: App) -> aiojobs.Scheduler:
    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

    if scheduler is None:
        return app["scheduler"]

    return scheduler


async def startup_check_db(app: App):
    if app["config"].no_check_db:
        return logger.info("Skipping database checks")

    db = app["db"]

    logger.info("Checking database")
    await migrate(app)

    # Make sure the indexes collection exists before later trying to set an compound
    # index on it.
    try:
        await db.motor_client.create_collection("indexes")
    except pymongo.errors.CollectionInvalid:
        pass


async def startup_data(app: App):
    """
    Create the application data layer object.

    :param app: the application object
    """

    app["data"] = create_data_layer(
        app["authorization"],
        app["db"],
        app["pg"],
        app["config"],
        app["client"],
        app["redis"],
    )


async def startup_dispatcher(app: App):
    """
    An application ``on_startup`` callback that initializes a Virtool
    :class:`~.Dispatcher` object and attaches it to the ``app`` object.

    :param app: the app object

    """
    logger.info("Starting dispatcher")

    DispatcherSQLEvents(app["dispatcher_interface"].enqueue_change)

    app["dispatcher"] = Dispatcher(
        app["pg"], app["db"], RedisDispatcherListener(app["redis"], "channel:dispatch")
    )

    await get_scheduler_from_app(app).spawn(app["dispatcher"].run())


async def startup_executors(app: App):
    """
    An application ``on_startup`` callback that initializes a
    :class:`~ThreadPoolExecutor` and attaches it to the ``app`` object.

    :param app: the application object

    """
    loop = asyncio.get_event_loop()

    thread_executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)

    loop.set_default_executor(thread_executor)

    process_executor = concurrent.futures.ProcessPoolExecutor()

    async def run_in_process(func, *args):
        return await loop.run_in_executor(process_executor, func, *args)

    app["run_in_process"] = run_in_process
    app["process_executor"] = process_executor


async def startup_http_client(app: App):
    """
    Create an async HTTP client session for the server.

    The client session is used to make requests to GitHub, NCBI, and
    https://www.virtool.ca.

    :param app: the application object

    """
    logging.info("Starting HTTP client")

    version = app["version"]

    headers = {
        "User-Agent": f"virtool/{version}",
    }

    app["client"] = aiohttp.client.ClientSession(headers=headers)


async def startup_databases(app: App):
    """
    Connects to MongoDB, Redis and Postgres concurrently

    :param app: the app object

    """
    config = get_config_from_app(app)

    mongo, pg, redis, openfga_instance = await asyncio.gather(
        connect_mongo(
            config.mongodb_connection_string,
            config.mongodb_database,
            config.no_revision_check,
        ),
        connect_pg(config.postgres_connection_string),
        connect(config.redis_connection_string),
        connect_openfga(
            config.openfga_host, config.openfga_scheme, config.openfga_store_name
        ),
    )

    scheduler = get_scheduler_from_app(app)
    await scheduler.spawn(periodically_ping_redis(redis))

    dispatcher_interface = DispatcherClient(redis)
    await get_scheduler_from_app(app).spawn(dispatcher_interface.run())

    app.update(
        {
            "authorization": AuthorizationClient(openfga_instance),
            "db": Mongo(mongo, dispatcher_interface.enqueue_change, RandomIdProvider()),
            "dispatcher_interface": dispatcher_interface,
            "pg": pg,
            "redis": redis,
        }
    )


async def startup_routes(app: App):
    logger.debug("Setting up routes")
    setup_routes(app, dev=app["config"].dev)


async def startup_sentry(app: App):
    """
    Create a Sentry client and attach it to the application if a DSN was configured.

    :param app: the application object
    """
    if app["config"].sentry_dsn:
        logger.info("Configuring Sentry")
        setup(app["version"], app["config"].sentry_dsn)
    else:
        logger.info("Skipped configuring Sentry")


async def startup_settings(app: App):
    """
    Draws settings from the settings database collection.

    Performs migration of old settings style to `v3.3.0` if necessary.

    :param app: the app object

    """
    await get_data_from_app(app).settings.ensure()


async def startup_version(app: App):
    """
    Store and log the Virtool version.

    :param app: the application object

    """
    version = await determine_server_version()

    logger.info("Virtool %s", version)
    logger.info("Mode: %s", app["mode"])

    app["version"] = version


async def startup_b2c(app: App):
    """
    Initiate connection to Azure AD B2C tenant.

    :param app: Application object
    """
    config = get_config_from_app(app)

    if not config.use_b2c:
        return

    if not all(
        [
            config.b2c_client_id,
            config.b2c_client_secret,
            config.b2c_tenant,
            config.b2c_user_flow,
        ]
    ):
        logger.critical(
            "Required B2C client information not provided for --use-b2c option"
        )
        sys.exit(1)

    authority = f"https://{config.b2c_tenant}.b2clogin.com/{config.b2c_tenant}.onmicrosoft.com/{config.b2c_user_flow}"

    msal = ClientApplication(
        client_id=app["config"].b2c_client_id,
        authority=authority,
        client_credential=app["config"].b2c_client_secret,
    )

    app["b2c"] = B2C(msal, authority)


async def startup_task_runner(app: App):
    """
    An application `on_startup` callback that initializes a Virtool
    :class:`virtool.tasks.runner.TaskRunner` object and puts it in app state.

    :param app: the app object

    """
    scheduler = get_scheduler_from_app(app)
    tasks_client = TasksClient(app["redis"])
    await scheduler.spawn(TaskRunner(app["data"], tasks_client, app).run())
