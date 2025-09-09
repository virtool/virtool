import asyncio
import os

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.analyses.sql import SQLAnalysisFile
from virtool.blast.sql import SQLNuVsBlast
from virtool.groups.pg import SQLGroup
from virtool.indexes.sql import SQLIndexFile
from virtool.labels.sql import SQLLabel
from virtool.messages.sql import SQLInstanceMessage
from virtool.ml.pg import SQLMLModel, SQLMLModelRelease
from virtool.pg.base import Base
from virtool.samples.sql import SQLSampleArtifact, SQLSampleReads
from virtool.sessions.pg import sessions_table
from virtool.spaces.sql import SQLSpace
from virtool.subtractions.pg import SQLSubtractionFile
from virtool.uploads.sql import SQLUpload
from virtool.users.pg import SQLUser, SQLUserGroup

config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
# NOTE: Disabled to prevent interference with Virtool's logging.
# fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

__models__ = (
    SQLAnalysisFile,
    SQLGroup,
    SQLIndexFile,
    SQLInstanceMessage,
    SQLLabel,
    SQLMLModel,
    SQLMLModelRelease,
    SQLNuVsBlast,
    SQLSampleArtifact,
    SQLSampleReads,
    SQLSpace,
    SQLSubtractionFile,
    SQLUpload,
    SQLUser,
    SQLUserGroup,
    sessions_table,
)


try:
    sqlalchemy_url = os.environ["SQLALCHEMY_URL"].replace("%", "%%")
except KeyError:
    raise OSError("SQLALCHEMY_URL environment variable not found.")

# Get the Postgres URL from environment.
config.set_main_option("sqlalchemy.url", sqlalchemy_url)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = AsyncEngine(
        engine_from_config(
            config.get_section(config.config_ini_section),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
            future=True,
        ),
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
