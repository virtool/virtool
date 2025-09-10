"""Configuration classes for the Virtool subcommands.

These will be available in the application context and should be accessed using
:func:`~virtool.utils.get_config_from_app` or
:func:`~virtool.utils.get_config_from_request`.

"""

from dataclasses import dataclass
from pathlib import Path

from pydantic import BaseModel
from pymongo.uri_parser import parse_uri

from virtool.authorization.openfga import OpenfgaScheme
from virtool.flags import FlagName


@dataclass
class MigrationConfig:
    """Configuration for the migration service."""

    data_path: Path
    mongodb_connection_string: str
    openfga_host: str
    openfga_scheme: OpenfgaScheme
    openfga_store_name: str
    postgres_connection_string: str

    @property
    def mongodb_name(self) -> str:
        """Get the name of the MongoDB database.

        :return: the database name

        """
        return parse_uri(self.mongodb_connection_string)["database"]

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
    openfga_host: str
    openfga_scheme: str
    openfga_store_name: str
    port: int
    postgres_connection_string: str
    real_ip_header: str
    redis_connection_string: str
    sentry_dsn: str | None

    @property
    def mongodb_database(self) -> str:
        return parse_uri(self.mongodb_connection_string)["database"]

    def __post_init__(self):
        self.data_path = Path(self.data_path)


@dataclass
class TaskRunnerConfig:
    """Configuration for the task runner service."""

    base_url: str
    data_path: Path
    host: str
    mongodb_connection_string: str
    no_revision_check: bool
    openfga_host: str
    openfga_scheme: str
    openfga_store_name: str
    port: int
    postgres_connection_string: str
    redis_connection_string: str
    sentry_dsn: str

    @property
    def mongodb_database(self) -> str:
        return parse_uri(self.mongodb_connection_string)["database"]

    def __post_init__(self):
        self.data_path = Path(self.data_path)


@dataclass
class TaskSpawnerConfig:
    """Configuration for the periodic task spawner"""

    base_url: str
    host: str
    port: int
    postgres_connection_string: str
    redis_connection_string: str
    sentry_dsn: str


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

    redis_connection_string: str
    """The connection string for the Redis database."""

    redis_list_name: str
    """The name of the redis list to pull job IDs from."""

    sentry_dsn: str
    """The DNS for reporting to Sentry."""

    timeout: int
    """How long to wait for a job ID from Redis."""

    work_path: Path
    """The path to a directory where the workflow can store temporary files."""


type Config = ServerConfig | TaskRunnerConfig | TaskSpawnerConfig
