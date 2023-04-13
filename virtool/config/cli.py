import asyncio
import json
from logging import getLogger

import click
import uvloop
from virtool_core.logging import configure_logs

import virtool.jobs.main
import virtool.tasks.main
import virtool.tasks.spawner
from virtool.app import run_app
from virtool.config.cls import (
    MigrationConfig,
    ServerConfig,
    TaskRunnerConfig,
    TaskSpawnerConfig,
)
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
from virtool.migration.apply import apply_to
from virtool.migration.create import create_revision
from virtool.oas.cmd import show_oas

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
    asyncio.get_event_loop().run_until_complete(run_app(ServerConfig(**kwargs)))


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

    asyncio.get_event_loop().run_until_complete(
        virtool.jobs.main.run(
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
    )


@cli.command
def oas():
    """Work with the Virtool OpenAPI specification."""
    show_oas()


@cli.group("migration")
def migration():
    """Run and manage Virtool data migrations."""
    ...


@migration.command("apply")
@data_path_option
@mongodb_connection_string_option
@openfga_options
@postgres_connection_string_option
@redis_connection_string_option
def migration_apply(**kwargs):
    """Apply all pending migrations."""
    configure_logs(False)

    logger.info("Applying migrations")

    asyncio.run(apply_to(MigrationConfig(**kwargs)))


@migration.command("create")
@click.option("--name", help="Name of the migration", required=True, type=str)
def migration_create(name: str):
    """Create a new migration revision."""
    create_revision(name)


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

    asyncio.get_event_loop().run_until_complete(
        virtool.tasks.main.run(TaskRunnerConfig(**kwargs, base_url=""))
    )


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
