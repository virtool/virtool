import asyncio
import json
from logging import getLogger

import click
import uvloop

from virtool_core.logging import configure_logs

from virtool.app import run_api_server
from virtool.config.cls import ServerConfig, TaskRunnerConfig, TaskSpawnerConfig
from virtool.config.options import (
    address_options,
    b2c_options,
    base_url_option,
    data_path_option,
    dev_option,
    mongodb_connection_string_option,
    no_check_db_option,
    no_check_files_option,
    no_revision_check_option,
    openfga_options,
    postgres_connection_string_option,
    redis_connection_string_option,
    sentry_dsn_option,
)
from virtool.jobs.main import run_jobs_server
import virtool.tasks.main
from virtool.oas.cmd import show_oas
from virtool.tasks.main import run_task_runner

logger = getLogger("config")


def create_default_map():
    try:
        with open("./config.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def entry():
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    default_map = create_default_map()
    cli(default_map=default_map)


@click.group()
def cli():
    ...


@cli.group("server")
def server():
    """Run Virtool HTTP services."""
    ...


@server.command("api")
@address_options
@b2c_options
@base_url_option
@data_path_option
@dev_option
@mongodb_connection_string_option
@no_check_db_option
@no_check_files_option
@no_revision_check_option
@openfga_options
@postgres_connection_string_option
@redis_connection_string_option
@sentry_dsn_option
def start_api_server(**kwargs):
    """Start a Virtool public API server."""
    configure_logs(kwargs["dev"])
    logger.info("Starting the public api service")

    run_api_server(ServerConfig(**kwargs))


@server.command("jobs")
@address_options
@data_path_option
@dev_option
@mongodb_connection_string_option
@no_check_db_option
@no_check_files_option
@no_revision_check_option
@openfga_options
@postgres_connection_string_option
@redis_connection_string_option
@sentry_dsn_option
def start_jobs_api(**kwargs):
    """Start a Virtool jobs API server"""
    configure_logs(kwargs["dev"])

    logger.info("Starting the jobs api service")

    run_jobs_server(
            ServerConfig(
                **kwargs,
                base_url="",
                b2c_client_id="",
                b2c_client_secret="",
                b2c_tenant="",
                b2c_user_flow="",
                use_b2c=False,
            )
        )


@cli.command
def oas():
    """Work with the Virtool OpenAPI specification."""
    show_oas()


@cli.group("tasks")
def tasks():
    """Manage Virtool tasks."""
    ...


@tasks.command("runner")
@address_options
@data_path_option
@mongodb_connection_string_option
@no_check_files_option
@no_revision_check_option
@openfga_options
@postgres_connection_string_option
@redis_connection_string_option
@sentry_dsn_option
def start_task_runner(**kwargs):
    """Start a service that pulls tasks queued in Redis and runs them."""
    configure_logs(False)

    logger.info("Starting tasks runner")

    run_task_runner(TaskRunnerConfig(**kwargs, base_url=""))


@tasks.command("spawn")
@postgres_connection_string_option
@redis_connection_string_option
@click.option("--task-name", help="Name of the task to spawn", type=str)
def spawn_task(task_name: str, **kwargs):
    """Create and queue a task instance of the given name."""
    configure_logs(False)

    logger.info("Spawning task")

    asyncio.get_event_loop().run_until_complete(
        virtool.tasks.spawner.spawn(TaskSpawnerConfig(**kwargs), task_name)
    )
