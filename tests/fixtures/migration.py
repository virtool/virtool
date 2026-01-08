"""Specialized fixtures for testing migrations.

Some of the fixtures in this module looks similar to other used for manipulating
Postgres (eg. :fixture:`pg` and :fixture:`migration_pg`). The difference is the
migration-flavoured fixtures dispose of the database after each test to eliminate any
schema conflicts between workflow.

"""

import os
from pathlib import Path
from random import choices
from string import ascii_lowercase

import alembic.command
import alembic.config
import orjson
import pytest
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import create_async_engine

from virtool.api.custom_json import dump_string
from virtool.config.cls import MigrationConfig
from virtool.migration.ctx import MigrationContext, create_migration_context
from virtool.migration.pg import SQLRevision
from virtool.pg.utils import (
    PgOptions,
    format_sqlalchemy_connection_string,
    get_sqlalchemy_url,
)


@pytest.fixture
async def migration_pg_connection_string(
    pg_base_connection_string: str,
    worker_id: str,
) -> str:
    """The connection string to a Postgres database for testing migrations.

    The database only has the revisions table created to avoid conflicts with tables
    required by regular workflow.
    """
    database = f"test_migration_{worker_id}"

    engine = create_async_engine(
        get_sqlalchemy_url(PgOptions(pg_base_connection_string)),
        isolation_level="AUTOCOMMIT",
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
    )

    async with engine.connect() as conn:
        await conn.execute(text(f"DROP DATABASE IF EXISTS {database} WITH (FORCE)"))

    async with engine.connect() as conn:
        try:
            await conn.execute(text(f"CREATE DATABASE {database}"))
        except ProgrammingError as exc:
            if "DuplicateDatabaseError" not in str(exc):
                raise

    await engine.dispose()

    connection_string = f"{pg_base_connection_string}/{database}"

    engine = create_async_engine(
        get_sqlalchemy_url(PgOptions(connection_string)),
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
        pool_recycle=1800,
    )

    async with engine.connect() as conn:
        await conn.run_sync(SQLRevision.__table__.create)
        await conn.commit()

    return connection_string


@pytest.fixture
def migration_pg_options(migration_pg_connection_string: str) -> PgOptions:
    return PgOptions(migration_pg_connection_string)


@pytest.fixture
def migration_pg(migration_pg_options: PgOptions):
    """A :class:`AsyncEngine` instance for a Postgres database for testing migrations."""
    return create_async_engine(
        get_sqlalchemy_url(migration_pg_options),
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
    )


@pytest.fixture
def revisions_path(mocker, tmpdir) -> Path:
    path = Path(tmpdir) / "assets/revisions"
    mocker.patch("virtool.migration.create.get_revisions_path", return_value=path)

    return path


@pytest.fixture
def migration_mongo_name(worker_id: str) -> str:
    suffix = "".join(choices(ascii_lowercase, k=8))
    return f"vt-test-{worker_id}-mig-{suffix}"


@pytest.fixture
def migration_config(
    data_path: Path,
    migration_pg_connection_string: str,
    mongo_connection_string: str,
    migration_mongo_name: str,
) -> MigrationConfig:
    """A :class:`MigrationConfig` instance that plugs into test instances of backing
    services.

    """
    return MigrationConfig(
        data_path=data_path,
        mongodb_connection_string=f"{mongo_connection_string}/{migration_mongo_name}?authSource=admin",
        postgres_connection_string=migration_pg_connection_string,
    )


@pytest.fixture
async def ctx(
    migration_config: MigrationConfig, migration_mongo_name: str
) -> MigrationContext:
    """A migration context for testing backed by test instances of backing services."""
    ctx = await create_migration_context(migration_config)
    yield ctx
    await ctx.mongo.client.drop_database(
        ctx.mongo.client.get_database(migration_mongo_name)
    )


@pytest.fixture
def apply_alembic(migration_pg_options: PgOptions):
    os.environ["SQLALCHEMY_URL"] = format_sqlalchemy_connection_string(
        migration_pg_options
    )

    def func(revision: str = "head"):
        alembic.command.upgrade(
            alembic.config.Config(Path(__file__).parent.parent.parent / "alembic.ini"),
            revision,
        )

    yield func

    os.environ["SQLALCHEMY_URL"] = ""
