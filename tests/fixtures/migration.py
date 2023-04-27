from pathlib import Path

import py.path
import pytest

from virtool.authorization.openfga import OpenfgaScheme
from virtool.config.cls import MigrationConfig
from virtool.migration.ctx import create_migration_context, RevisionContext


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
        pg_connection_string: str,
        tmpdir: py.path.local,
) -> MigrationConfig:
    return MigrationConfig(
        data_path=Path(tmpdir),
        mongodb_connection_string=f"{mongo_connection_string}/{mongo_name}?authSource=admin",
        openfga_host=openfga_host,
        openfga_scheme=openfga_scheme,
        openfga_store_name=openfga_store_name,
        postgres_connection_string=pg_connection_string,
    )


@pytest.fixture
async def ctx(migration_config: MigrationConfig, mongo_name) -> RevisionContext:
    ctx = await create_migration_context(migration_config)

    async with ctx.revision_context() as revision_ctx:
        mongo = revision_ctx.mongo.client.get_database(mongo_name)
        yield revision_ctx

        await revision_ctx.mongo.client.drop_database(mongo)
