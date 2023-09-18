import asyncio
import sys
from concurrent.futures import ProcessPoolExecutor
from dataclasses import dataclass
from structlog import get_logger

from aiohttp import ClientSession
from aiojobs.aiohttp import get_scheduler_from_app
from msal import ClientApplication
from pymongo.errors import CollectionInvalid
from virtool_core.redis import connect as connect_redis, periodically_ping_redis

from virtool.authorization.client import (
    AuthorizationClient,
    get_authorization_client_from_app,
)
from virtool.authorization.openfga import connect_openfga
from virtool.config import get_config_from_app
from virtool.data.events import EventPublisher
from virtool.data.layer import create_data_layer
from virtool.data.utils import get_data_from_app
from virtool.migration.pg import check_data_revision_version
from virtool.mongo.connect import connect_mongo
from virtool.mongo.core import Mongo
from virtool.mongo.identifier import RandomIdProvider
from virtool.mongo.migrate import migrate_status
from virtool.oidc.utils import JWKArgs
from virtool.pg.utils import connect_pg
from virtool.routes import setup_routes
from virtool.sentry import setup
from virtool.tasks.client import TasksClient
from virtool.tasks.runner import TaskRunner
from virtool.types import App
from virtool.utils import get_http_session_from_app
from virtool.version import determine_server_version, get_version_from_app
from virtool.ws.server import WSServer


logger = get_logger("startup")


@dataclass
class B2C:
    msal: ClientApplication
    authority: str
    jwk_args: JWKArgs = None
    auth_code_flow: dict = None


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
        client_id=get_config_from_app(app).b2c_client_id,
        authority=authority,
        client_credential=get_config_from_app(app).b2c_client_secret,
    )

    app["b2c"] = B2C(msal, authority)


async def startup_check_db(app: App):
    if get_config_from_app(app).no_check_db:
        return logger.info("Skipping database checks")

    db = app["db"]

    logger.info("Checking database")
    await migrate_status(db)

    # Make sure the indexes collection exists before later trying to set an compound
    # index on it.
    try:
        await db.motor_client.create_collection("indexes")
    except CollectionInvalid:
        pass


async def startup_data(app: App):
    """
    Create the application data layer object.

    :param app: the application object
    """

    app["data"] = create_data_layer(
        get_authorization_client_from_app(app),
        app["db"],
        app["pg"],
        get_config_from_app(app),
        get_http_session_from_app(app),
        app["redis"],
    )


async def startup_databases(app: App):
    """
    Connects to MongoDB, Redis and Postgres concurrently

    :param app: the app object

    """
    config = get_config_from_app(app)

    mongo, pg, redis, openfga_instance = await asyncio.gather(
        connect_mongo(config.mongodb_connection_string, config.mongodb_database),
        connect_pg(config.postgres_connection_string),
        connect_redis(config.redis_connection_string),
        connect_openfga(
            config.openfga_host, config.openfga_scheme, config.openfga_store_name
        ),
    )

    if not get_config_from_app(app).no_revision_check:
        await check_data_revision_version(pg)

    await get_scheduler_from_app(app).spawn(periodically_ping_redis(redis))

    app.update(
        {
            "authorization": AuthorizationClient(openfga_instance),
            "db": Mongo(mongo, RandomIdProvider()),
            "pg": pg,
            "redis": redis,
        }
    )


async def startup_events(app: App):
    """Create and run the event publisher."""
    app["events"] = EventPublisher(app["redis"])
    await get_scheduler_from_app(app).spawn(app["events"].run())


async def startup_executors(app: App):
    """
    An application ``on_startup`` callback that initializes a
    :class:`~ThreadPoolExecutor` and attaches it to the ``app`` object.

    :param app: the application object

    """
    loop = asyncio.get_event_loop()

    process_executor = ProcessPoolExecutor()

    async def run_in_process(func, *args):
        return await loop.run_in_executor(process_executor, func, *args)

    app["run_in_process"] = run_in_process
    app["process_executor"] = process_executor


async def startup_http_client_session(app: App):
    """
    Create an async HTTP client session for the server.

    The client session is used to make requests to GitHub, NCBI, and
    https://www.virtool.ca.

    :param app: the application object

    """
    logger.info("Starting HTTP client")

    app["client"] = ClientSession(
        headers={"User-Agent": f"virtool/{get_version_from_app(app)}"}
    )


async def startup_routes(app: App):
    setup_routes(app, dev=get_config_from_app(app).dev)


async def startup_sentry(app: App):
    """
    Create a Sentry client and attach it to the application if a DSN was configured.

    :param app: the application object
    """
    if get_config_from_app(app).sentry_dsn:
        logger.info("Configuring Sentry")
        setup(app["version"], get_config_from_app(app).sentry_dsn)
    else:
        logger.info("Skipped configuring Sentry")


async def startup_settings(app: App):
    """
    Draws settings from the settings database collection.

    Performs migration of old settings style to `v3.3.0` if necessary.

    :param app: the app object

    """
    await get_data_from_app(app).settings.ensure()


async def startup_task_runner(app: App):
    """
    An application `on_startup` callback that initializes a Virtool
    :class:`virtool.tasks.runner.TaskRunner` object and puts it in app state.

    :param app: the app object

    """
    tasks_client = TasksClient(app["redis"])
    await get_scheduler_from_app(app).spawn(TaskRunner(app["data"], tasks_client).run())


async def startup_version(app: App):
    """
    Store and log the Virtool version.

    :param app: the application object

    """
    version = await determine_server_version()

    logger.info("Virtool %s", version)
    logger.info("Mode: %s", app["mode"])

    app["version"] = version


async def startup_ws(app: App):
    """Start the websocket server."""
    logger.info("Starting websocket server")

    ws = WSServer(app["redis"])

    scheduler = get_scheduler_from_app(app)

    await scheduler.spawn(ws.run())
    await scheduler.spawn(ws.periodically_close_expired_websocket_connections())

    logger.info("Closing expired WS connections")

    app["ws"] = ws
