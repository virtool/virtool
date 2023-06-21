from pathlib import Path

import py.path
import pytest
from orjson import orjson
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from sqlalchemy.ext.asyncio import create_async_engine

from virtool.api.custom_json import dump_string
from virtool.authorization.openfga import OpenfgaScheme
from virtool.config.cls import MigrationConfig
from virtool.migration.ctx import create_migration_context, MigrationContext
from virtool.migration.pg import SQLRevision
from virtool.pg.base import Base


@pytest.fixture
async def migration_pg_connection_string(
    pg_base_connection_string: str, worker_id: str
) -> str:
    database = f"test_migration_{worker_id}"

    engine = create_async_engine(
        pg_base_connection_string,
        isolation_level="AUTOCOMMIT",
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
    )

    async with engine.connect() as conn:
        try:
            await conn.execute(text(f"CREATE DATABASE {database}"))
        except ProgrammingError as exc:
            if "DuplicateDatabaseError" not in str(exc):
                raise

    await engine.dispose()

    connection_string = f"{pg_base_connection_string}/{database}"

    pg = create_async_engine(
        connection_string,
        json_serializer=dump_string,
        json_deserializer=orjson.loads,
        pool_recycle=1800,
    )

    async with pg.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(SQLRevision.__table__.create)
        await conn.commit()

    return connection_string


@pytest.fixture
def revisions_path(mocker, tmpdir) -> Path:
    path = Path(tmpdir) / "assets/revisions"
    mocker.patch("virtool.migration.create.get_revisions_path", return_value=path)

    return path


@pytest.fixture
def migration_config(
    mongo_connection_string: str,
    mongo_name: str,
    openfga_host: str,
    openfga_scheme: OpenfgaScheme,
    openfga_store_name: str,
    migration_pg_connection_string: str,
    tmpdir: py.path.local,
) -> MigrationConfig:
    return MigrationConfig(
        data_path=Path(tmpdir),
        mongodb_connection_string=f"{mongo_connection_string}/{mongo_name}?authSource=admin",
        openfga_host=openfga_host,
        openfga_scheme=openfga_scheme,
        openfga_store_name=openfga_store_name,
        postgres_connection_string=migration_pg_connection_string,
    )


@pytest.fixture
async def ctx(migration_config: MigrationConfig, mongo_name) -> MigrationContext:
    ctx = await create_migration_context(migration_config)
    yield ctx
    await ctx.mongo.client.drop_database(ctx.mongo.client.get_database(mongo_name))
