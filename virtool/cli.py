"""The definition of the command line interface for Virtool."""

import asyncio
import json
from pathlib import Path

import click
import uvloop
from structlog import get_logger

from virtool.app import run_api_server
from virtool.config.cls import (
    MigrationConfig,
    ServerConfig,
    TaskRunnerConfig,
    TaskSpawnerConfig,
    WorkflowConfig,
)
from virtool.config.options import (
    address_options,
    base_url_option,
    data_path_option,
    dev_option,
    flags_option,
    get_from_environment,
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
from virtool.migration.depend import depend
from virtool.migration.show import show_revisions
from virtool.oas.cmd import show_oas
from virtool.tasks.main import run_task_runner, run_task_spawner
from virtool.workflow.runtime.run import start_runtime

logger = get_logger("config")


def create_default_map():
    try:
        with open("./config.json") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def entry() -> None:
    uvloop.install()
    default_map = create_default_map()
    cli(default_map=default_map)


@click.group()
def cli() -> None: ...


@cli.group("server")
def server() -> None:
    """Run Virtool HTTP services."""


@server.command("api")
@address_options
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
def start_api_server(**kwargs) -> None:
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
def start_jobs_api(**kwargs) -> None:
    """Start a Virtool jobs API server."""
    configure_logging(bool(kwargs["sentry_dsn"]))

    logger.info("starting the jobs api service")

    run_jobs_server(
        ServerConfig(
            **kwargs,
            base_url="",
        ),
    )


@cli.command
def oas() -> None:
    """Work with the Virtool OpenAPI specification."""
    show_oas()


@cli.group("migration")
def migration() -> None:
    """Run and manage Virtool data migrations."""


@migration.command("apply")
@data_path_option
@mongodb_connection_string_option
@openfga_options
@postgres_connection_string_option
def migration_apply(**kwargs) -> None:
    """Apply all pending migrations."""
    configure_logging(False)
    logger.info("starting migration")
    asyncio.run(apply(MigrationConfig(**kwargs)))


@migration.command("create")
@click.option("--name", help="Name of the migration", required=True, type=str)
def migration_create(name: str) -> None:
    """Create a new migration revision."""
    create_revision(name)


@migration.command("depend")
@click.option("--revision", help="Revision to depend on", default="latest", type=str)
def migration_depend(revision: str) -> None:
    """Update Virtool so that it depends on a revision having been applied."""
    depend(revision)


@migration.command("show")
def migration_show(**kwargs) -> None:
    """Apply all pending migrations."""
    configure_logging(False)
    show_revisions()


@cli.group("tasks")
def tasks() -> None:
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
def start_task_runner(dev: bool, **kwargs) -> None:
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
def tasks_spawner(dev: bool, **kwargs) -> None:
    """Schedule all periodically run tasks on hardcoded schedules"""
    configure_logging(bool(kwargs["sentry_dsn"]))

    logger.info("starting task spawner")

    run_task_spawner(TaskSpawnerConfig(**kwargs, base_url=""))


@cli.group("workflow")
def workflow() -> None:
    """Manage Virtool workflows."""


@dev_option
@click.option(
    "--jobs-api-connection-string",
    help="The URL of the jobs API.",
    default=get_from_environment(
        "jobs_api_connection_string", "https://localhost:9950"
    ),
    type=str,
)
@click.option(
    "--mem",
    default=get_from_environment("mem", 4),
    help="The amount of memory to use in GB.",
    type=int,
)
@click.option(
    "--proc",
    default=get_from_environment("proc", 2),
    help="The number of processes to use.",
    type=int,
)
@redis_connection_string_option
@click.option(
    "--redis-list-name",
    default=get_from_environment("redis_list_name", ""),
    help="The name of the Redis list to watch for incoming jobs.",
    type=str,
)
@sentry_dsn_option
@click.option(
    "--timeout",
    default=get_from_environment(
        "timeout",
        1000,
    ),
    help="Maximum time to wait for an incoming job",
    type=int,
)
@click.option(
    "--work-path",
    default=get_from_environment("work_path", "temp"),
    help="The path where temporary files will be stored.",
    type=click.Path(path_type=Path),
)
@workflow.command(name="run")
def workflow_run(
    dev: bool,
    jobs_api_connection_string: str,
    mem: int,
    proc: int,
    redis_connection_string: str,
    redis_list_name: str,
    sentry_dsn: str,
    timeout: int,
    work_path: Path,
) -> None:
    """Run a workflow."""
    config = WorkflowConfig(
        dev=dev,
        jobs_api_connection_string=jobs_api_connection_string,
        mem=mem,
        proc=proc,
        redis_connection_string=redis_connection_string,
        redis_list_name=redis_list_name,
        sentry_dsn=sentry_dsn,
        timeout=timeout,
        work_path=work_path,
    )

    asyncio.run(start_runtime(config))
