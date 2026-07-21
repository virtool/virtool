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

import click

from virtool.config.cls import CACHE_STORAGE_BUDGET
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

cache_storage_budget_option = click.option(
    "--cache-storage-budget",
    default=get_from_environment(
        "cache_storage_budget",
        CACHE_STORAGE_BUDGET,
    ),
    help="The cache storage budget in bytes",
    type=int,
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

no_revision_check_option = click.option(
    "--no-revision-check",
    default=get_from_environment("no_revision_check", False),
    help="Disable the data revision check",
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
            default=get_from_environment("storage_backend", None),
            help="The object-storage backend to use",
            required=True,
            type=click.Choice(["s3", "azure"]),
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
        click.option(
            "--storage-azure-endpoint",
            default=get_from_environment("storage_azure_endpoint", ""),
            help=(
                "Azure Blob Storage endpoint URL (e.g. for Azurite or "
                "non-default regions); leave empty to use the default Azure "
                "endpoint"
            ),
            type=str,
        ),
    ]:
        func = decorator(func)

    return func
