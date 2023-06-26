"""
Reusable Click options for CLI subcommands.

"""
import os

import click

from virtool.flags import FlagName


def get_from_environment(key, default):
    return os.environ.get(f"VT_{key.upper()}", default)


def address_options(func):
    for decorator in [
        click.option(
            "--host",
            default=get_from_environment("host", "localhost"),
            help="The host the server should listen on",
            type=str,
        ),
        click.option(
            "--port",
            default=get_from_environment("port", 9950),
            help="The port the server should listen on",
            type=int,
        ),
    ]:
        func = decorator(func)

    return func


def b2c_options(func):
    for decorator in [
        click.option(
            "--use-b2c",
            default=get_from_environment("use_b2c", False),
            help="Use Azure AD B2C for authentication",
            is_flag=True,
        ),
        click.option(
            "--b2c-client-id",
            default=get_from_environment("b2c_client_id", ""),
            help="Azure AD B2C client ID (required for --use-b2c)",
            type=str,
        ),
        click.option(
            "--b2c-client-secret",
            default=get_from_environment("b2c_client_secret", ""),
            help="Azure AD B2C client secret (required for --use-b2c)",
            type=str,
        ),
        click.option(
            "--b2c-tenant",
            default=get_from_environment("b2c_tenant", ""),
            help="Azure AD B2C tenant name",
            type=str,
        ),
        click.option(
            "--b2c-user-flow",
            default=get_from_environment("b2c_user_flow", ""),
            help="Azure AD B2C signupsignin user flow, required for --use-b2c",
            type=str,
        ),
    ]:
        func = decorator(func)

    return func


base_url_option = click.option(
    "--base-url",
    default=get_from_environment("base_url", ""),
    help="The URL used to prefix Location headers and redirects",
    type=str,
)

data_path_option = click.option(
    "--data-path",
    default=get_from_environment("data_path", "./data"),
    help="The path to the application data directory",
    type=click.Path(exists=True),
)

dev_option = click.option(
    "--dev",
    default=get_from_environment("dev", False),
    help="Run in development mode",
    is_flag=True,
)

flags_option = click.option(
    "--flags",
    help="feature flag of the feature to enable",
    type=click.Choice([flag.name for flag in FlagName], case_sensitive=False),
    required=False,
    multiple=True,
    default=[],
)

mongodb_connection_string_option = click.option(
    "--mongodb-connection-string",
    default=get_from_environment(
        "mongodb_connection_string", "mongodb://root:virtool@localhost:27017/virtool"
    ),
    help="The MongoDB connection string",
    type=str,
)

no_check_db_option = click.option(
    "--no-check-db", help="Start without checking and repairing database", is_flag=True
)

no_revision_check_option = click.option(
    "--no-revision-check",
    default=get_from_environment("no_revision_check", False),
    help="Disable the MongoDB revision check",
    is_flag=True,
)


def openfga_options(func):
    for decorator in [
        click.option(
            "--openfga-host",
            help="The OpenFGA API host",
            type=str,
            default=get_from_environment("openfga_host", "localhost:8080"),
        ),
        click.option(
            "--openfga-scheme",
            default=get_from_environment("openfga_scheme", "https"),
            help="The OpenFGA API scheme",
            type=str,
        ),
        click.option(
            "--openfga-store-name",
            default=get_from_environment("openfga_store_name", "Virtool"),
            help="The OpenFGA API store",
            type=str,
        ),
    ]:
        func = decorator(func)

    return func


postgres_connection_string_option = click.option(
    "--postgres-connection-string",
    default=get_from_environment(
        "postgres_connection_string",
        "postgresql+asyncpg://virtool:virtool@localhost/virtool",
    ),
    help="The PostgreSQL connection string (must begin with 'postgresql+asyncpg://')",
    type=str,
)

redis_connection_string_option = click.option(
    "--redis-connection-string",
    default=get_from_environment(
        "redis_connection_string", "redis://root:virtool@localhost:6379"
    ),
    help="The Redis connection string",
    required=True,
    type=str,
)

sentry_dsn_option = click.option(
    "--sentry-dsn",
    default=get_from_environment("sentry_dsn", ""),
    help="A Sentry DSN to report errors to",
    type=str,
)
