import asyncio
import json
import logging
import os
import sys

import click
import psutil
import uvloop

import jobs_api_process
import virtool.app
import virtool.db.mongo
import virtool.db.utils
import virtool.jobs.classes
import virtool.jobs.job
import virtool.jobs.run
import virtool.jobs.runner
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


def create_default_map():
    try:
        with open("./config.json", "r") as f:
            return json.load(f)
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
@click.option(
    "--data-path",
    default="data",
    help="The path to the application data directory",
    type=click.Path()
)
@click.option(
    "--db-connection-string",
    default="mongodb://localhost:27017",
    help="The MongoDB connection string",
    type=str
)
@click.option(
    "--db-name",
    default="virtool",
    help="The MongoDB database name",
    type=str
)
@click.option(
    "--dev",
    help="Run in development mode",
    is_flag=True
)
@click.option(
    "--force-version",
    help="Make the instance think it is a different version",
    type=str
)
@click.option(
    "--no-sentry",
    help="Disable Sentry error reporting",
    is_flag=True
)
@click.option(
    "--postgres-connection-string",
    help="The PostgreSQL connection string (must begin with 'postgresql+asyncpg://')",
    type=str,
    default="postgresql+asyncpg://virtool:virtool@localhost/virtool"
)
@click.option(
    "--proxy",
    help="The address for an internet proxy to connect through",
    type=str
)
@click.option(
    "--redis-connection-string",
    help="The Redis connection string",
    type=str,
    required=True,
    default="redis://localhost:6379"
)
@click.option(
    "--verbose",
    help="Log debug messages",
    is_flag=True
)
@click.pass_context
def cli(ctx, data_path, db_connection_string, db_name, dev, force_version, no_sentry, proxy, postgres_connection_string,
        redis_connection_string, verbose):
    ctx.ensure_object(dict)
    ctx.obj.update({
        "data_path": data_path,
        "db_connection_string": db_connection_string,
        "db_name": db_name,
        "dev": dev,
        "force_version": force_version,
        "no_sentry": no_sentry,
        "proxy": proxy,
        "postgres_connection_string": postgres_connection_string,
        "redis_connection_string": redis_connection_string,
        "verbose": verbose
    })


@cli.command("server", help="Start a Virtool API and websocket server")
@click.option(
    "--host",
    default="localhost",
    help="The host to listen on",
    type=str
)
@click.option(
    "--port",
    default=9950,
    help="The port to listen on",
    type=int
)
@click.option(
    "--no-check-db",
    help="Start without checking and repairing database",
    is_flag=True
)
@click.option(
    "--no-check-files",
    help="Start without ensuring data directory is valid",
    is_flag=True
)
@click.option(
    "--no-client",
    help="Start without serving client files",
    is_flag=True
)
@click.option(
    "--no-fetching",
    help="Start with automatic fetching disabled",
    is_flag=True
)
@click.pass_context
def start_server(ctx, host, port, no_check_db, no_check_files, no_client, no_fetching):
    virtool.logs.configure_server(ctx.obj["dev"], ctx.obj["verbose"])

    config = {
        **ctx.obj,
        "host": host,
        "port": port,
        "no_check_db": no_check_db,
        "no_check_files": no_check_files,
        "no_client": no_client,
        "no_fetching": no_fetching
    }

    logger.info("Starting in server mode")
    asyncio.get_event_loop().run_until_complete(virtool.app.run_app(config))


@cli.command("runner", help="Start a runner that runs one job at a time")
@click.option(
    "--job-list", "-l",
    default=["jobs_lg", "jobs_sm"],
    help="A Redis list key to pull job IDs from",
    multiple=True,
    type=str
)
@click.option(
    "--mem",
    default=1,
    help="The maximum memory (GB) the instance may use",
    type=int
)
@click.option(
    "--proc",
    default=1,
    help="The maximum number of processes the instance can use",
    type=int
)
@click.option(
    "--temp-path",
    type=click.Path(),
    help="The path to local directory for temporary files"
)
@click.pass_context
def start_runner(ctx, job_list, mem, proc, temp_path):
    virtool.logs.configure_runner(ctx.obj["dev"], ctx.obj["verbose"])

    config = {
        **ctx.obj,
        "job_list": job_list,
        "mem": mem,
        "proc": proc,
        "temp_path": temp_path
    }

    logger.info("Starting in runner mode")
    asyncio.get_event_loop().run_until_complete(virtool.jobs.run.run(config, virtool.jobs.runner.JobRunner))


@cli.command("jobsAPI")
@click.pass_context
def start_jobs_api(ctx):
    logger.info("Starting jobs API process")
    asyncio.get_event_loop().run_until_complete(jobs_api_process.run(**ctx.obj))
