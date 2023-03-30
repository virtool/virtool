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


@cli.command("server", help="Start a Virtool API and websocket server")
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
def start_server(
    **kwargs,
):
    configure_logs(kwargs["dev"])

    logger.info("Starting in server mode")
    asyncio.get_event_loop().run_until_complete(run_app(ServerConfig(**kwargs)))


@cli.command("jobsAPI")
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
    """Start a Virtool Jobs API server"""
    configure_logs(kwargs["dev"])

    logger.info("Starting jobs API process")

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


@cli.command("tasks")
@address_options
@data_path_option
@mongodb_connection_string_option
@no_check_files_option
@no_revision_check_option
@openfga_options
@postgres_connection_string_option
@redis_connection_string_option
@sentry_dsn_option
def start_task_runner(
    **kwargs,
):
    configure_logs(False)

    logger.info("Starting tasks worker")

    asyncio.get_event_loop().run_until_complete(
        virtool.tasks.main.run(TaskRunnerConfig(**kwargs, base_url=""))
    )


@cli.command("spawn_task")
@postgres_connection_string_option
@redis_connection_string_option
@sentry_dsn_option
@click.option("--task-name", help="Name of the task to spawn", type=str)
def spawn_task(task_name, **kwargs):
    configure_logs(False)

    logger.info("Spawning task")

    asyncio.get_event_loop().run_until_complete(
        virtool.tasks.spawner.spawn(TaskSpawnerConfig(**kwargs), task_name)
    )
