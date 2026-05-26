"""Configuration classes for the Virtool subcommands.

These will be available in the application context and should be accessed using
:func:`~virtool.utils.get_config_from_app` or
:func:`~virtool.utils.get_config_from_request`.

"""

from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from pydantic import BaseModel
from pymongo.uri_parser import parse_uri

from virtool.flags import FlagName
from virtool.pg.utils import PgOptions

StorageBackendName = Literal["s3", "azure"]


def _validate_s3_credentials(access_key_id: str, secret_access_key: str) -> None:
    """Reject partial S3 credential config.

    Both keys empty is fine (use IAM role / instance metadata) and both keys
    set is fine. Anything else likely means a typo in an env-var name produced
    a silent empty default, which would otherwise be indistinguishable from
    intentional reliance on instance credentials.
    """
    if bool(access_key_id) != bool(secret_access_key):
        raise ValueError(
            "storage_s3_access_key_id and storage_s3_secret_access_key must be "
            "set together, or both left empty to use IAM role credentials",
        )


@dataclass
class MigrationConfig:
    """Configuration for the migration service."""

    data_path: Path
    mongodb_connection_string: str
    postgres_connection_string: str

    @property
    def mongodb_name(self) -> str:
        """Get the name of the MongoDB database.

        :return: the database name

        """
        return parse_uri(self.mongodb_connection_string)["database"]

    @property
    def pg_options(self):
        return PgOptions.from_connection_string(self.postgres_connection_string)

    def __post_init__(self):
        self.data_path = Path(self.data_path)


@dataclass
class ServerConfig:
    base_url: str
    data_path: Path
    dev: bool
    flags: list[FlagName]
    host: str
    mongodb_connection_string: str
    no_check_db: bool
    no_periodic_tasks: bool
    no_revision_check: bool
    port: int
    postgres_connection_string: str
    real_ip_header: str
    sentry_dsn: str | None
    storage_backend: StorageBackendName
    storage_s3_bucket: str = ""
    storage_s3_region: str = ""
    storage_s3_endpoint: str = ""
    storage_s3_access_key_id: str = ""
    storage_s3_secret_access_key: str = ""
    storage_azure_account: str = ""
    storage_azure_container: str = ""
    storage_azure_access_key: str = ""
    storage_azure_endpoint: str = ""

    @property
    def mongodb_database(self) -> str:
        return parse_uri(self.mongodb_connection_string)["database"]

    @property
    def pg_options(self) -> PgOptions:
        return PgOptions.from_connection_string(self.postgres_connection_string)

    def __post_init__(self):
        self.data_path = Path(self.data_path)

        if self.storage_backend == "s3" and not self.storage_s3_bucket:
            raise ValueError(
                "storage_backend=s3 requires --storage-s3-bucket",
            )

        if self.storage_backend == "s3":
            _validate_s3_credentials(
                self.storage_s3_access_key_id,
                self.storage_s3_secret_access_key,
            )

        if self.storage_backend == "azure":
            if not self.storage_azure_account:
                raise ValueError(
                    "storage_backend=azure requires --storage-azure-account",
                )
            if not self.storage_azure_container:
                raise ValueError(
                    "storage_backend=azure requires --storage-azure-container",
                )


@dataclass
class TaskRunnerConfig:
    """Configuration for the task runner service."""

    base_url: str
    data_path: Path
    host: str
    mongodb_connection_string: str
    no_revision_check: bool
    port: int
    postgres_connection_string: str
    sentry_dsn: str
    storage_backend: StorageBackendName
    storage_s3_bucket: str = ""
    storage_s3_region: str = ""
    storage_s3_endpoint: str = ""
    storage_s3_access_key_id: str = ""
    storage_s3_secret_access_key: str = ""
    storage_azure_account: str = ""
    storage_azure_container: str = ""
    storage_azure_access_key: str = ""
    storage_azure_endpoint: str = ""

    @property
    def mongodb_database(self) -> str:
        return parse_uri(self.mongodb_connection_string)["database"]

    @property
    def pg_options(self) -> PgOptions:
        return PgOptions.from_connection_string(self.postgres_connection_string)

    def __post_init__(self):
        self.data_path = Path(self.data_path)

        if self.storage_backend == "s3" and not self.storage_s3_bucket:
            raise ValueError(
                "storage_backend=s3 requires --storage-s3-bucket",
            )

        if self.storage_backend == "s3":
            _validate_s3_credentials(
                self.storage_s3_access_key_id,
                self.storage_s3_secret_access_key,
            )

        if self.storage_backend == "azure":
            if not self.storage_azure_account:
                raise ValueError(
                    "storage_backend=azure requires --storage-azure-account",
                )
            if not self.storage_azure_container:
                raise ValueError(
                    "storage_backend=azure requires --storage-azure-container",
                )


@dataclass
class TaskSpawnerConfig:
    """Configuration for the periodic task spawner"""

    base_url: str
    host: str
    port: int
    postgres_connection_string: str
    sentry_dsn: str

    @property
    def pg_options(self) -> PgOptions:
        return PgOptions.from_connection_string(self.postgres_connection_string)


class WorkflowConfig(BaseModel):
    """The configuration for a workflow run."""

    dev: bool
    """Whether the workflow should run in development mode."""

    jobs_api_connection_string: str
    """The connection string for the jobs API."""

    mem: int
    """The memory limit for the workflow run."""

    proc: int
    """The number of processors available to the workflow run."""

    sentry_dsn: str
    """The DNS for reporting to Sentry."""

    timeout: int
    """How long to wait for a job to claim."""

    workflow: str
    """The workflow name this runner handles (e.g. 'pathoscope', 'nuvs')."""

    work_path: Path
    """The path to a directory where the workflow can store temporary files."""


type Config = ServerConfig | TaskRunnerConfig | TaskSpawnerConfig
