from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config(object):
    db_connection_string: str
    db_name: str
    dev: bool
    postgres_connection_string: str
    redis_connection_string: str
    no_sentry: bool = False
    no_fetching: bool = False
    no_check_files: bool = False
    no_check_db: bool = False
    force_version: str = None
    verbose: bool = False
    data_path: Path = None
    proxy: str = None
    host: str = None
    no_client: bool = False
    port: int = 9950
    fake: bool = False
    fake_path: Path = None
    b2c_client_id: str = None
    b2c_client_secret: str = None
    b2c_tenant: str = None
    b2c_user_flow: str = None
    use_b2c: bool = False
