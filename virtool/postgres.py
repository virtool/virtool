import logging
import sys

import sqlalchemy
from sqlalchemy import create_engine

logger = logging.getLogger(__name__)


async def connect(postgres_connection_string: str) -> sqlalchemy.engine:
    if not postgres_connection_string.startswith("postgresql://"):
        logger.fatal("Invalid PostgreSQL connection string")
        sys.exit(1)

    try:
        postgres = create_engine(postgres_connection_string)
        connection = postgres.connect()

        await check_version(connection)

        return connection
    except ConnectionRefusedError:
        logger.fatal("Could not connect to PostgreSQL: Connection refused")
        sys.exit(1)


async def check_version(connection):
    with connection as con:
        info = con.execute('SHOW server_version').fetchone()

    version = info[0].split()[0]
    logger.info(f"Found PostgreSQL {version}")
    return
