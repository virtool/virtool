"""Reusable Click options for CLI subcommands.

Decorate a Click command with these options to add them to the command:

```
@address_options
@click.command()
def my_command(host, port):
    ...
```
"""

import os
from pathlib import Path

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
        "mongodb_connection_string",
        "mongodb://root:virtool@localhost:27017/virtool",
    ),
    help="The MongoDB connection string",
    type=str,
)

no_check_db_option = click.option(
    "--no-check-db",
    help="Start without checking and repairing database",
    is_flag=True,
)

no_revision_check_option = click.option(
    "--no-revision-check",
    default=get_from_environment("no_revision_check", False),
    help="Disable the MongoDB revision check",
    is_flag=True,
)

no_periodic_tasks_option = click.option(
    "--no-periodic-tasks",
    default=get_from_environment("no_periodic_tasks", False),
    help="Don't spawn periodic tasks",
    is_flag=True,
)

real_ip_header_option = click.option(
    "--real-ip-header",
    default=get_from_environment("real_ip_header", ""),
    help="The request header containing the original client's IP address",
    type=str,
)

postgres_connection_string_option = click.option(
    "--postgres-connection-string",
    default=get_from_environment(
        "postgres_connection_string",
        "postgresql://virtool:virtool@localhost/virtool",
    ),
    help="The PostgreSQL connection string",
    type=str,
)

sentry_dsn_option = click.option(
    "--sentry-dsn",
    default=get_from_environment("sentry_dsn", ""),
    help="A Sentry DSN to report errors to",
    type=str,
)


def storage_options(func):
    for decorator in [
        click.option(
            "--storage-backend",
            default=get_from_environment("storage_backend", "filesystem"),
            help="The storage backend to use for object storage",
            type=click.Choice(["filesystem", "s3", "azure"]),
        ),
        click.option(
            "--storage-filesystem-path",
            default=get_from_environment("storage_filesystem_path", None),
            help=(
                "Base directory for the filesystem backend "
                "(defaults to <data-path>/storage)"
            ),
            type=click.Path(path_type=Path),
        ),
        click.option(
            "--storage-s3-bucket",
            default=get_from_environment("storage_s3_bucket", ""),
            help="S3 bucket name (required when --storage-backend=s3)",
            type=str,
        ),
        click.option(
            "--storage-s3-region",
            default=get_from_environment("storage_s3_region", ""),
            help="S3 region",
            type=str,
        ),
        click.option(
            "--storage-s3-endpoint",
            default=get_from_environment("storage_s3_endpoint", ""),
            help="S3 endpoint URL override (for MinIO or S3-compatible services)",
            type=str,
        ),
        click.option(
            "--storage-s3-access-key-id",
            default=get_from_environment("storage_s3_access_key_id", ""),
            help="S3 access key ID",
            type=str,
        ),
        click.option(
            "--storage-s3-secret-access-key",
            default=get_from_environment("storage_s3_secret_access_key", ""),
            help="S3 secret access key",
            type=str,
        ),
        click.option(
            "--storage-azure-account",
            default=get_from_environment("storage_azure_account", ""),
            help=(
                "Azure Blob Storage account name "
                "(required when --storage-backend=azure)"
            ),
            type=str,
        ),
        click.option(
            "--storage-azure-container",
            default=get_from_environment("storage_azure_container", ""),
            help=(
                "Azure Blob Storage container name "
                "(required when --storage-backend=azure)"
            ),
            type=str,
        ),
        click.option(
            "--storage-azure-access-key",
            default=get_from_environment("storage_azure_access_key", ""),
            help="Azure Blob Storage access key",
            type=str,
        ),
    ]:
        func = decorator(func)

    return func
