import datetime
from dataclasses import asdict

import arrow
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.matchers import path_type

from virtool.config.cls import MigrationConfig
from virtool.migration.apply import apply
from virtool.migration.pg import SQLRevision, list_applied_revisions
from virtool.migration.show import load_all_revisions


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


async def test_apply_revisions_with_missing_last_applied(
    migration_config: MigrationConfig,
    migration_pg: AsyncEngine,
    snapshot,
):
    """Test that migrations work when the last applied revision no longer exists.

    This happens when Virtool revisions are removed from the codebase but records
    of their application remain in the database.
    """
    all_revisions = load_all_revisions()

    now = arrow.utcnow().naive

    async with AsyncSession(migration_pg) as session:
        # Pre-populate the revisions table with all current revisions.
        for revision in all_revisions:
            session.add(
                SQLRevision(
                    applied_at=now,
                    created_at=revision.created_at,
                    name=revision.name,
                    revision=revision.id,
                ),
            )

        # Add a fake "deleted" Virtool revision as the last applied.
        session.add(
            SQLRevision(
                applied_at=now,
                created_at=now,
                name="deleted_virtool_revision",
                revision="fake_deleted_revision_id",
            ),
        )

        await session.commit()

    # This should not raise and should skip all already-applied revisions.
    await apply(migration_config)

    applied = await list_applied_revisions(migration_pg)

    # The fake revision should still be in the list.
    assert any(r.revision == "fake_deleted_revision_id" for r in applied)

    # All real revisions should be present.
    for revision in all_revisions:
        assert any(r.revision == revision.id for r in applied)
