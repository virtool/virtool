import datetime
from dataclasses import asdict

from sqlalchemy.ext.asyncio import AsyncEngine
from syrupy.matchers import path_type

from virtool.config.cls import MigrationConfig
from virtool.migration.apply import apply
from virtool.migration.pg import list_applied_revisions


async def test_apply_revisions(
    migration_config: MigrationConfig, migration_pg: AsyncEngine, snapshot
):
    await apply(migration_config)

    assert [asdict(r) for r in await list_applied_revisions(migration_pg)] == snapshot(
        matcher=path_type(
            {
                ".*applied_at": (datetime.datetime,),
                ".*created_at": (datetime.datetime,),
            },
            regex=True,
        )
    )
