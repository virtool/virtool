import asyncio
import json
import logging
from pathlib import Path

import click
import uvloop

import virtool.app
import virtool.jobs.main
from virtool.configuration.config import Config
from virtool.logs import configure_logs

logger = logging.getLogger(__name__)


def create_default_map():
    try:
        with open("./config.json", "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


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
        "data_path": Path(data_path),
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
    "--no-fetching",
    help="Start with automatic fetching disabled",
    is_flag=True
)
@click.option(
    "--b2c-client-id",
    help="Azure AD B2C client ID, required for --use-b2c",
    type=str
)
@click.option(
    "--b2c-client-secret",
    help="Azure AD B2C client secret, required for --use-b2c",
    type=str
)
@click.option(
    "--b2c-tenant",
    help="Azure AD B2C tenant name",
    type=str
)
@click.option(
    "--b2c-user-flow",
    help="Azure AD B2C signupsignin user flow, required for --use-b2c",
    type=str,
)
@click.option(
    "--use-b2c",
    help="Use Azure AD B2C for authentication",
    is_flag=True
)
@click.pass_context
def start_server(
        ctx,
        host,
        port,
        no_check_db,
        no_check_files,
        no_fetching,
        b2c_client_id,
        b2c_client_secret,
        b2c_tenant,
        b2c_user_flow,
        use_b2c
):
    configure_logs(ctx.obj["dev"], ctx.obj["verbose"])

    config = Config(
        **ctx.obj,
        b2c_client_id=b2c_client_id,
        b2c_client_secret=b2c_client_secret,
        b2c_tenant=b2c_tenant,
        b2c_user_flow=b2c_user_flow,   
        host=host,        
        no_check_db=no_check_db,
        no_check_files=no_check_files,
        no_fetching=no_fetching,
        port=port,
        use_b2c=use_b2c,
    )

    logger.info("Starting in server mode")
    asyncio.get_event_loop().run_until_complete(virtool.app.run_app(config))


@cli.command("jobsAPI")
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
    "--fake-path",
    help=("Start the jobs API with fake data for integration testing. "
          "The data will be loaded from any YAML files under this path."),
    type=click.Path(exists=True, dir_okay=True),
    default=None
)
@click.pass_context
def start_jobs_api(ctx, fake_path, port, host):
    """Start a Virtool Jobs API server"""
    configure_logs(ctx.obj["dev"], ctx.obj["verbose"])

    logger.info("Starting jobs API process")

    config = Config(
        **ctx.obj,
        host=host,
        fake=fake_path is not None,
        fake_path=fake_path,
        port=port,        
    )

    asyncio.get_event_loop().run_until_complete(
        virtool.jobs.main.run(config)
    )
