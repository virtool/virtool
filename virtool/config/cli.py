"""The definition of the command line interface for Virtool."""

import asyncio
import json

import click
import uvloop
from structlog import get_logger

from virtool.app import run_api_server
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
    flags_option,
    mongodb_connection_string_option,
    no_check_db_option,
    no_revision_check_option,
    openfga_options,
    postgres_connection_string_option,
    real_ip_header_option,
    redis_connection_string_option,
    sentry_dsn_option,
)
from virtool.jobs.main import run_jobs_server
from virtool.logs import configure_logging
from virtool.migration.apply import apply
from virtool.migration.create import create_revision
from virtool.migration.show import show_revisions
from virtool.oas.cmd import show_oas
from virtool.tasks.main import run_task_runner, run_task_spawner

logger = get_logger("config")


def create_default_map():
    try:
        with open("./config.json") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def entry():
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    default_map = create_default_map()
    cli(default_map=default_map)


@click.group()
def cli(): ...


@cli.group("server")
def server():
    """Run Virtool HTTP services."""


@server.command("api")
@address_options
@b2c_options
@base_url_option
@data_path_option
@dev_option
@flags_option
@mongodb_connection_string_option
@no_check_db_option
@no_revision_check_option
@openfga_options
@postgres_connection_string_option
@real_ip_header_option
@redis_connection_string_option
@sentry_dsn_option
def start_api_server(**kwargs):
    """Start a Virtool public API server."""
    configure_logging(bool(kwargs["sentry_dsn"]))
    logger.info("starting the public api service")

    run_api_server(ServerConfig(**kwargs))


@server.command("jobs")
@address_options
@data_path_option
@dev_option
@flags_option
@mongodb_connection_string_option
@no_check_db_option
@no_revision_check_option
@openfga_options
@postgres_connection_string_option
@real_ip_header_option
@redis_connection_string_option
@sentry_dsn_option
def start_jobs_api(**kwargs):
    """Start a Virtool jobs API server"""
    configure_logging(bool(kwargs["sentry_dsn"]))

    logger.info("starting the jobs api service")

    run_jobs_server(
        ServerConfig(
            **kwargs,
            base_url="",
            b2c_client_id="",
            b2c_client_secret="",
            b2c_tenant="",
            b2c_user_flow="",
            use_b2c=False,
        ),
    )


@cli.command
def oas():
    """Work with the Virtool OpenAPI specification."""
    show_oas()


@cli.group("migration")
def migration():
    """Run and manage Virtool data migrations."""


@migration.command("apply")
@data_path_option
@mongodb_connection_string_option
@openfga_options
@postgres_connection_string_option
def migration_apply(**kwargs):
    """Apply all pending migrations."""
    configure_logging(False)
    logger.info("starting migration")
    asyncio.run(apply(MigrationConfig(**kwargs)))


@migration.command("create")
@click.option("--name", help="Name of the migration", required=True, type=str)
def migration_create(name: str):
    """Create a new migration revision."""
    create_revision(name)


@migration.command("show")
def migration_show(**kwargs):
    """Apply all pending migrations."""
    configure_logging(False)
    show_revisions()


@cli.group("tasks")
def tasks():
    """Manage Virtool tasks."""


@tasks.command("runner")
@address_options
@data_path_option
@dev_option
@mongodb_connection_string_option
@no_revision_check_option
@openfga_options
@postgres_connection_string_option
@redis_connection_string_option
@sentry_dsn_option
def start_task_runner(dev: bool, **kwargs):
    """Start a service that pulls tasks queued in Redis and runs them."""
    configure_logging(bool(kwargs["sentry_dsn"]))

    logger.info("starting tasks runner")

    run_task_runner(TaskRunnerConfig(**kwargs, base_url=""))


@tasks.command("spawner")
@address_options
@dev_option
@postgres_connection_string_option
@redis_connection_string_option
@sentry_dsn_option
def tasks_spawner(dev: bool, **kwargs):
    """Schedule all periodically run tasks on hardcoded schedules"""
    configure_logging(bool(kwargs["sentry_dsn"]))

    logger.info("starting task spawner")

    run_task_spawner(TaskSpawnerConfig(**kwargs, base_url=""))
