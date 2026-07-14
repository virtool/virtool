import datetime
from dataclasses import asdict

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from syrupy.matchers import path_type

from virtool.config.cls import MigrationConfig
from virtool.migration.apply import apply, ensure_revisions_table
from virtool.migration.pg import SQLRevision, list_applied_revisions
from virtool.migration.show import load_all_revisions


@pytest.mark.timeout(30)
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


class TestEnsureRevisionsTable:
    async def test_widens_legacy_columns(self, migration_pg: AsyncEngine):
        """A revision name longer than the legacy 64-character limit can be recorded.

        The table was originally created with `name varchar(64)` and
        `revision varchar(18)`. Revision names have since outgrown that limit, and
        `CREATE TABLE IF NOT EXISTS` will not widen a table that already exists.
        """
        async with AsyncSession(migration_pg) as session, session.begin():
            await session.execute(text("DROP TABLE revisions"))
            await session.execute(
                text(
                    """
                    CREATE TABLE revisions (
                        id SERIAL PRIMARY KEY,
                        name varchar(64) NOT NULL,
                        revision varchar(18) NOT NULL,
                        created_at timestamp without time zone NOT NULL,
                        applied_at timestamp without time zone NOT NULL
                    )
                    """,
                ),
            )

        await ensure_revisions_table(migration_pg)

        now = arrow.utcnow().naive
        long_name = (
            "add sequence isolate_id and segment columns and otu reference_id index"
        )

        async with AsyncSession(migration_pg) as session:
            session.add(
                SQLRevision(
                    applied_at=now,
                    created_at=now,
                    name=long_name,
                    revision="5de38ebeaa78",
                ),
            )

            await session.commit()

        assert [r.name for r in await list_applied_revisions(migration_pg)] == [
            long_name,
        ]


@pytest.mark.timeout(30)
async def test_apply_fills_in_missed_earlier_revision(
    migration_config: MigrationConfig,
    migration_pg: AsyncEngine,
):
    """A revision missing from the table is applied even when a later revision is
    already recorded.

    Recording only the head revision simulates a history where revisions were
    applied out of order: every earlier revision is unrecorded. The position-based
    scan used to skip all of them because they sort before the recorded head; now
    each unrecorded revision is filled in. Because every earlier revision is applied
    from a fresh database, this exercises the whole migration chain and needs the same
    generous timeout as :func:`test_apply_revisions`.
    """
    all_revisions = load_all_revisions()
    head = all_revisions[-1]

    async with AsyncSession(migration_pg) as session:
        session.add(
            SQLRevision(
                applied_at=arrow.utcnow().naive,
                created_at=head.created_at,
                name=head.name,
                revision=head.id,
            ),
        )
        await session.commit()

    await apply(migration_config)

    applied_ids = {r.revision for r in await list_applied_revisions(migration_pg)}

    for revision in all_revisions:
        assert revision.id in applied_ids
