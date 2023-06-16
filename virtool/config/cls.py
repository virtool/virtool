from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Union, List

from pymongo.uri_parser import parse_uri

from virtool.authorization.openfga import OpenfgaScheme


@dataclass
class MigrationConfig:
    """
    Configuration for the migration service.

    """

    data_path: Path
    mongodb_connection_string: str
    openfga_host: str
    openfga_scheme: OpenfgaScheme
    openfga_store_name: str
    postgres_connection_string: str

    @property
    def mongodb_name(self) -> str:
        """
        Get the name of the MongoDB database.

        :return: the database name

        """
        return parse_uri(self.mongodb_connection_string)["database"]

    def __post_init__(self):
        self.data_path = Path(self.data_path)


@dataclass
class ServerConfig:
    base_url: str
    b2c_client_id: Optional[str]
    b2c_client_secret: Optional[str]
    b2c_tenant: Optional[str]
    b2c_user_flow: Optional[str]
    data_path: Path
    dev: bool
    host: str
    mongodb_connection_string: str
    no_check_db: bool
    no_revision_check: bool
    openfga_host: str
    openfga_scheme: str
    openfga_store_name: str
    port: int
    postgres_connection_string: str
    redis_connection_string: str
    use_b2c: bool
    sentry_dsn: Optional[str]
    cli_flags: List[str] = field(default_factory=list)

    @property
    def mongodb_database(self) -> str:
        return parse_uri(self.mongodb_connection_string)["database"]

    def __post_init__(self):
        self.data_path = Path(self.data_path)


@dataclass
class TaskRunnerConfig:
    """
    Configuration for the task runner service.

    """

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
    """
    Configuration for the task spawner.

    """

    postgres_connection_string: str
    redis_connection_string: str


@dataclass
class PeriodicTaskSpawnerConfig:
    """
    Configuration for the periodic task spawner
    """

    base_url: str
    postgres_connection_string: str
    redis_connection_string: str
    host: str
    port: int


Config = Union[
    ServerConfig, TaskRunnerConfig, TaskSpawnerConfig, PeriodicTaskSpawnerConfig
]
