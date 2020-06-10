import uvloop
import asyncio
import json
import logging
import os
import sys

import click
import psutil

import virtool.app
import virtool.db.mongo
import virtool.db.utils
import virtool.jobs.runner
import virtool.jobs.classes
import virtool.jobs.job
import virtool.jobs.run
import virtool.logs
import virtool.redis
import virtool.utils

logger = logging.getLogger(__name__)

CONFIG_PATH = os.path.join(sys.path[0], "config.json")

JOB_LIMIT_KEYS = (
    "lg_proc",
    "lg_mem",
    "sm_proc",
    "sm_mem"
)

OPTIONS = {
    "data_path": click.option(
        "--data-path",
        default="data",
        help="The path to the application data directory",
        type=click.Path()
    ),
    "db_connection_string": click.option(
        "--db-connection-string",
        default="mongodb://localhost:27017",
        help="The MongoDB connection string",
        type=str
    ),
    "db_name": click.option(
        "--db-name",
        default="virtool",
        help="The MongoDB database name",
        type=str
    ),
    "dev": click.option(
        "--dev",
        help="Run in development mode",
        is_flag=True
    ),
    "force_version": click.option(
        "--force-version",
        help="Make the instance think it is the passed version",
        is_flag=True
    ),
    "host": click.option(
        "--host",
        default="localhost",
        help="The host to listen on"
    ),
    "job_id": click.option(
        "--job-id",
        help="The ID of the job to run",
        required=True,
        type=str
    ),
    "job_list": click.option(
        "--job-list", "-l",
        default=["jobs_lg", "jobs_sm"],
        multiple=True
    ),
    "no_check_db": click.option(
        "--no-check-db",
        help="Start without checking and repairing database",
        is_flag=True
    ),
    "no_check_files": click.option(
        "--no-check-files",
        help="Start without ensuring data directory is valid",
        is_flag=True
    ),
    "no_client": click.option(
        "--no-client",
        help="Start without serving client files",
        is_flag=True
    ),
    "no_fetching": click.option(
        "--no-fetching",
        help="Start with automatic fetching disabled",
        is_flag=True
    ),
    "no_file_manager": click.option(
        "--no-file-manager",
        help="Start without the file manager",
        is_flag=True
    ),
    "no_job_manager": click.option(
        "--no-job-manager",
        help="Start without a job runner",
        is_flag=True
    ),
    "no_sentry": click.option(
        "--no-sentry",
        help="Disable Sentry error reporting",
        is_flag=True
    ),
    "lg_mem": click.option(
        "--lg-mem",
        default=1,
        help="The maximum memory (GB) the runner may use"
    ),
    "lg_proc":click.option(
        "--lg-proc",
        default=1,
        help="The maximum memory (GB) the runner may use"
    ),
    "mem": click.option(
        "--mem",
        default=1,
        help="The maximum memory (GB) the instance may use"
    ),
    "port": click.option(
        "--port",
        default=9950,
        help="The port to listen on"
    ),
    "proc": click.option(
        "--proc",
        default=1,
        help="The maximum number of processes the instance can use"
    ),
    "proxy": click.option(
        "--proxy",
        help="The address for an internet proxy to connect through"
    ),
    "redis_connection_string": click.option(
        "--redis-connection-string",
        help="The Redis connection string",
        type=str,
        required=True,
    ),
    "sm_mem": click.option(
        "--sm-mem",
        default=1,
        help="The maximum memory (GB) the runner may use"
    ),
    "sm_proc": click.option(
        "--sm-proc",
        default=1,
        help="The maximum memory (GB) the runner may use"
    ),
    "temp_path": click.option(
        "--temp-path",
        type=click.Path(),
        help="The path to local directory for temporary files"
    ),
    "verbose": click.option(
        "--verbose",
        help="Log debug messages",
        is_flag=True
    )
}

ADDRESS_OPTIONS = (
    "host",
    "port"
)

COMMON_OPTIONS = (
    "data_path",
    "db_connection_string",
    "db_name",
    "dev",
    "force_version",
    "no_sentry",
    "proxy",
    "redis_connection_string",
    "verbose"
)

DISABLE_OPTIONS = (
    "no_client",
    "no_check_db",
    "no_check_files",
    "no_fetching",
    "no_file_manager",
    "no_job_manager"
)

RESOURCE_OPTIONS = (
    "lg_mem",
    "lg_proc",
    "mem",
    "proc",
    "sm_mem",
    "sm_proc"
)

MODE_SCOPED_OPTIONS = {
    "agent": (
        *COMMON_OPTIONS,
        *RESOURCE_OPTIONS,
        "job_list",
        "temp_path"
    ),
    "runner": (
        *COMMON_OPTIONS,
        "job_list",
        "mem",
        "proc",
        "temp_path"
    ),
    "server": (
        *ADDRESS_OPTIONS,
        *COMMON_OPTIONS,
        *DISABLE_OPTIONS
    )
}


def use_options(mode):
    option_keys = [
        *COMMON_OPTIONS,
        *MODE_SCOPED_OPTIONS[mode]
    ]

    options = [OPTIONS[key] for key in option_keys]

    def inner(func):
        for option in options:
            func = option(func)

        return func

    return inner


def create_default_map():
    try:
        with open("./config.json", "r") as f:
            json_config = json.load(f)

            default_map = dict()

            for mode, option_keys in MODE_SCOPED_OPTIONS.items():
                default_map[mode] = {o: json_config[o] for o in option_keys if o in json_config}

            return default_map
    except FileNotFoundError:
        return None


def validate_limits(config):
    cpu_count = psutil.cpu_count()
    mem_total = psutil.virtual_memory().total

    proc = int(config["proc"])
    mem = int(config["mem"])

    fatal = False

    if proc > cpu_count:
        fatal = True
        logger.fatal(f"Configured proc limit ({proc}) exceeds host CPU count ({cpu_count})")

    in_bytes = mem * 1024 * 1024 * 1024

    if in_bytes > mem_total:
        fatal = True
        logger.fatal(f"Configured mem limit ({in_bytes}) exceeds host memory ({mem_total})")

    for job_limit_key in JOB_LIMIT_KEYS:
        resource_key = job_limit_key.split("_")[1]

        job_limit = int(config[job_limit_key])
        host_limit = int(config[resource_key])

        if job_limit > host_limit:
            fatal = True
            logger.fatal(
                f"Configured {job_limit_key} ({job_limit}) exceeds instance {resource_key} limit ({host_limit})"
            )

    if fatal:
        sys.exit(1)

    return cpu_count, mem_total


def entry():
    asyncio.set_event_loop_policy(uvloop.EventLoopPolicy())
    default_map = create_default_map()
    cli(auto_envvar_prefix="VT", default_map=default_map)


@click.group()
def cli():
    pass


@cli.command("server", help="Start a Virtool API and websocket server")
@use_options("server")
def start_server(**kwargs):
    virtool.logs.configure(kwargs)
    data_path = kwargs["data_path"]
    logger.info(f"Found data path: {data_path}")
    asyncio.get_event_loop().run_until_complete(virtool.app.run_app(kwargs))


@cli.command("agent", help="Start an agent that runs multiple jobs")
@use_options("agent")
def start_agent(**kwargs):
    virtool.logs.configure(kwargs)
    data_path = kwargs["data_path"]
    logger.info(f"Found data path: {data_path}")
    validate_limits(kwargs)

    logger.info("Starting in agent mode")
    asyncio.get_event_loop().run_until_complete(virtool.jobs.run.run(kwargs, virtool.jobs.runner.JobAgent))


@cli.command("runner", help="Start a runner that runs one job at a time")
@use_options("runner")
def start_runner(**kwargs):
    virtool.logs.configure(kwargs)
    data_path = kwargs["data_path"]
    logger.info(f"Found data path: {data_path}")

    logger.info("Starting in runner mode")
    asyncio.get_event_loop().run_until_complete(virtool.jobs.run.run(kwargs, virtool.jobs.runner.JobRunner))
