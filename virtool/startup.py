import asyncio
import concurrent.futures
import logging
import signal
import sys
import typing
from dataclasses import dataclass
from typing import Dict
from urllib.parse import urlparse, urlunparse

import aiohttp.client
import aiojobs
import aiojobs.aiohttp
import pymongo.errors
from aiohttp.web import Application
from msal import ClientApplication
from virtool_core.redis import connect, periodically_ping_redis
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.utils import connect_openfga

import virtool.mongo.connect
import virtool.pg.utils
from virtool.analyses.tasks import StoreNuvsFilesTask
from virtool.config import get_config_from_app
from virtool.data.factory import create_data_layer
from virtool.data.utils import get_data_from_app
from virtool.dev.fake import create_fake_data_path
from virtool.dispatcher.client import DispatcherClient
from virtool.dispatcher.dispatcher import Dispatcher
from virtool.dispatcher.events import DispatcherSQLEvents
from virtool.dispatcher.listener import RedisDispatcherListener
from virtool.fake.wrapper import FakerWrapper
from virtool.hmm.tasks import HMMRefreshTask
from virtool.indexes.tasks import (
    EnsureIndexFilesTask,
)
from virtool.jobs.tasks import TimeoutJobsTask
from virtool.mongo.core import DB
from virtool.mongo.identifier import RandomIdProvider
from virtool.mongo.migrate import migrate
from virtool.oidc.utils import JWKArgs
from virtool.pg.testing import create_test_database
from virtool.references.db import refresh_remotes
from virtool.references.tasks import (
    CleanReferencesTask,
)
from virtool.routes import setup_routes
from virtool.samples.tasks import CompressSamplesTask, MoveSampleFilesTask
from virtool.sentry import setup
from virtool.subtractions.tasks import (
    AddSubtractionFilesTask,
    CheckSubtractionsFASTATask,
)
from virtool.tasks.client import TasksClient
from virtool.tasks.runner import TaskRunner
from virtool.types import App
from virtool.uploads.tasks import MigrateFilesTask
from virtool.utils import ensure_data_dir, random_alphanumeric
from virtool.version import determine_server_version

logger = logging.getLogger("startup")


@dataclass
class B2C:
    msal: ClientApplication
    authority: str
    jwk_args: JWKArgs = None
    auth_code_flow: dict = None


def create_events() -> Dict[str, asyncio.Event]:
    """
    Create and store :class:`asyncio.Event` objects for triggering an application
    restart or shutdown.

    :return: a `dict` with :class:`~asyncio.Event` objects for restart and shutdown

    """
    return {"restart": asyncio.Event(), "shutdown": asyncio.Event()}


def get_scheduler_from_app(app: Application) -> aiojobs.Scheduler:
    scheduler = aiojobs.aiohttp.get_scheduler_from_app(app)

    if scheduler is None:
        return app["scheduler"]

    return scheduler


async def startup_check_db(app: Application):
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


async def startup_dispatcher(app: Application):
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


async def startup_events(app: Application):
    events = create_events()

    loop = asyncio.get_event_loop()

    loop.add_signal_handler(signal.SIGINT, events["shutdown"].set)
    loop.add_signal_handler(signal.SIGTERM, events["shutdown"].set)

    app["events"] = events


async def startup_executors(app: Application):
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


async def startup_fake(app: Application):
    if app["config"].fake:
        app["fake"] = FakerWrapper()


async def startup_fake_config(app: App):
    """
    If the ``fake`` config flag is set, patch the config so that the MongoDB and
    Postgres databases and the data directory are faked.

    :param app:

    """
    suffix = random_alphanumeric()

    if app["config"].fake:
        url = urlparse(app["config"].postgres_connection_string)

        base_connection_string = urlunparse((url.scheme, url.netloc, "", "", "", ""))

        name = f"fake_{suffix}"

        await create_test_database(base_connection_string, name)

        app["config"].db_name = f"fake-{suffix}"
        app["config"].data_path = create_fake_data_path()
        app["config"].postgres_connection_string = f"{base_connection_string}/{name}"


async def startup_http_client(app: Application):
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


async def startup_paths(app: Application):
    if app["config"].no_check_files is False:
        logger.info("Checking files")
        ensure_data_dir(app["config"].data_path)


async def startup_databases(app: Application):
    """
    Connects to MongoDB, Redis and Postgres concurrently

    :param app: the app object

    """
    db_connection_string = app["config"].db_connection_string
    db_name = app["config"].db_name
    postgres_connection_string = app["config"].postgres_connection_string
    redis_connection_string = app["config"].redis_connection_string
    openfga_host = app["config"].openfga_host
    openfga_scheme = app["config"].openfga_scheme
    openfga_store_name = app["config"].openfga_store_name
    skip_revision_check = app["config"].no_revision_check

    mongo, pg, redis, openfga_instance = await asyncio.gather(
        virtool.mongo.connect.connect(
            db_connection_string, db_name, skip_revision_check
        ),
        virtool.pg.utils.connect(postgres_connection_string),
        connect(redis_connection_string),
        connect_openfga(openfga_host, openfga_scheme, openfga_store_name),
    )

    scheduler = get_scheduler_from_app(app)
    await scheduler.spawn(periodically_ping_redis(redis))

    app["redis"] = redis
    dispatcher_interface = DispatcherClient(app["redis"])
    await get_scheduler_from_app(app).spawn(dispatcher_interface.run())

    app.update(
        {
            "db": DB(mongo, dispatcher_interface.enqueue_change, RandomIdProvider()),
            "dispatcher_interface": dispatcher_interface,
            "pg": pg,
            "authorization": AuthorizationClient(openfga_instance),
        }
    )


async def startup_refresh(app: Application):
    """
    Start async jobs for checking for new remote reference and HMM releases.

    :param app: the application object

    """
    if app["config"].no_fetching:
        return logger.info("Running without automatic update checking")

    scheduler = get_scheduler_from_app(app)

    await scheduler.spawn(refresh_remotes(app))


async def startup_routes(app: Application):
    logger.debug("Setting up routes")
    setup_routes(app, dev=app["config"].dev)


async def startup_sentry(app: typing.Union[dict, Application]):
    settings = await get_data_from_app(app).settings.get_all()
    if (
        not app["config"].no_sentry
        and settings.enable_sentry is not False
        and app["config"].sentry_dsn
        and not app["config"].dev
    ):
        logger.info("Configuring Sentry")
        setup(app["version"], app["config"].sentry_dsn)

    else:
        logger.info("Skipped configuring Sentry")


async def startup_settings(app: typing.Union[dict, Application]):
    """
    Draws settings from the settings database collection.

    Performs migration of old settings style to `v3.3.0` if necessary.

    :param app: the app object

    """
    await get_data_from_app(app).settings.ensure()


async def startup_version(app: typing.Union[dict, Application]):
    """
    Bind the application version to the application state `dict`.

    The value will come by checking `--force-version`, the `VERSION` file, or the
    current Git tag if the containing folder is a Git repository.

    :param app: the application object

    """
    force_version = app["config"].force_version

    if force_version:
        version = force_version
    else:
        version = await determine_server_version()

    logger.info("Virtool %s", version)
    logger.info("Mode: %s", app["mode"])

    app["version"] = version


async def startup_b2c(app: Application):
    """
    Initiate connection to Azure AD B2C tenant.

    :param app: Application object
    """
    b2c_tenant = app["config"].b2c_tenant
    b2c_user_flow = app["config"].b2c_user_flow

    if not all(
        [
            app["config"].b2c_client_id,
            app["config"].b2c_client_secret,
            b2c_tenant,
            b2c_user_flow,
        ]
    ):
        logger.critical(
            "Required B2C client information not provided for --use-b2c option"
        )
        sys.exit(1)

    authority = f"https://{b2c_tenant}.b2clogin.com/{b2c_tenant}.onmicrosoft.com/{b2c_user_flow}"

    msal = ClientApplication(
        client_id=app["config"].b2c_client_id,
        authority=authority,
        client_credential=app["config"].b2c_client_secret,
    )

    app["b2c"] = B2C(msal, authority)


async def startup_task_runner(app: Application):
    """
    An application `on_startup` callback that initializes a Virtool
    :class:`virtool.tasks.runner.TaskRunner` object and puts it in app state.

    :param app: the app object

    """

    if not get_config_from_app(app).no_tasks:
        scheduler = get_scheduler_from_app(app)
        tasks_client = TasksClient(app["redis"])
        await scheduler.spawn(TaskRunner(app["data"], tasks_client, app).run())


async def startup_tasks(app: Application):
    if get_config_from_app(app).no_tasks:
        return

    tasks_data = get_data_from_app(app).tasks

    if app["config"].no_check_db:
        return logger.info("Skipping subtraction FASTA files checks")

    if not app["config"].no_fetching:
        await tasks_data.create_periodically(HMMRefreshTask, 600)
    else:
        logger.info("Running without automatic update checking")

    scheduler = get_scheduler_from_app(app)

    logger.info("Checking subtraction FASTA files")

    await tasks_data.create(CheckSubtractionsFASTATask)
    await tasks_data.create(EnsureIndexFilesTask)
    await tasks_data.create(AddSubtractionFilesTask)
    await tasks_data.create(StoreNuvsFilesTask)
    await tasks_data.create(CompressSamplesTask)
    await tasks_data.create(MoveSampleFilesTask)
    await tasks_data.create(CleanReferencesTask)
    await tasks_data.create(TimeoutJobsTask)

    await scheduler.spawn(tasks_data.create_periodically(MigrateFilesTask, 3600))
