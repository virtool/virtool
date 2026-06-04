"""Tests for the re-backfill subtractions to postgres migration.

The shared copy logic is exercised thoroughly through the original revision in
``test_copy_subtractions_to_postgres``. These tests cover only what this revision
owns: re-running the backfill after the first run already populated Postgres, so
subtractions written between the original backfill and the dual-write rollout are
captured without duplicating rows already present.
"""

from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_eta57bpbxmn1_re_backfill_subtractions_to_postgres import (
    upgrade as re_backfill,
)
from assets.revisions.rev_ztd04qgecm9a_copy_subtractions_to_postgres import (
    upgrade as original_backfill,
)
from tests.migration.test_copy_subtractions_to_postgres import (
    make_subtraction_document,
    setup_user,
    static_datetime,
)
from virtool.migration.ctx import MigrationContext

__all__ = ["setup_user", "static_datetime"]


class TestReBackfill:
    async def test_captures_documents_added_after_first_backfill(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """A document written after the original backfill is picked up on re-run."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="original",
                user_id=setup_user,
                created_at=static_datetime,
            ),
        )

        await original_backfill(ctx)

        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="straggler",
                user_id=setup_user,
                created_at=static_datetime,
            ),
        )

        await re_backfill(ctx)

        async with AsyncSession(ctx.pg) as session:
            legacy_ids = (
                (
                    await session.execute(
                        text("SELECT legacy_id FROM subtractions ORDER BY legacy_id"),
                    )
                )
                .scalars()
                .all()
            )

        assert legacy_ids == ["original", "straggler"]

    async def test_does_not_duplicate_already_copied_rows(
        self,
        ctx: MigrationContext,
        setup_user: int,
        static_datetime: datetime,
    ):
        """Re-running after a full backfill leaves a single row per document."""
        await ctx.mongo.subtraction.insert_one(
            make_subtraction_document(
                subtraction_id="already_copied",
                user_id=setup_user,
                created_at=static_datetime,
            ),
        )

        await original_backfill(ctx)
        await re_backfill(ctx)

        async with AsyncSession(ctx.pg) as session:
            count = (
                await session.execute(
                    text(
                        "SELECT COUNT(*) FROM subtractions "
                        "WHERE legacy_id = 'already_copied'",
                    ),
                )
            ).scalar_one()

        assert count == 1
