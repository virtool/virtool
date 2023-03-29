from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config:
    db_connection_string: str
    db_name: str
    dev: bool
    openfga_host: str
    openfga_scheme: str
    openfga_store_name: str
    postgres_connection_string: str
    redis_connection_string: str
    b2c_client_id: str = None
    b2c_client_secret: str = None
    b2c_tenant: str = None
    b2c_user_flow: str = None
    base_url: str = ""
    data_path: Path = None
    fake: bool = False
    fake_path: Path = None
    force_version: str = None
    host: str = None
    no_check_files: bool = False
    no_check_db: bool = False
    no_fetching: bool = False
    no_revision_check: bool = False
    port: int = 9950
    use_b2c: bool = False
    verbose: bool = False
    sentry_dsn: str = ""
