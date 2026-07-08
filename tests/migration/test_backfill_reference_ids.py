"""Tests for the backfill-reference-ids-to-integers migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_xgqo66avrcdh_backfill_reference_ids_to_integers import (
    upgrade,
)
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def setup_references(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict[str, int]:
    """Apply alembic head and seed a user and two references with legacy ids."""
    await asyncio.to_thread(apply_alembic, "head")

    now = arrow.utcnow().naive

    async with AsyncSession(ctx.pg) as session:
        user_id = (
            await session.execute(
                text("""
                    INSERT INTO users (
                        handle, legacy_id, active, email, force_reset,
                        invalidate_sessions, last_password_change, password, settings
                    )
                    VALUES (
                        'alice', 'alice_legacy', true, '',
                        false, false, :now, :pw, '{}'::jsonb
                    )
                    RETURNING id
                """),
                {"now": now, "pw": b"hashed"},
            )
        ).scalar_one()

        result = await session.execute(
            text("""
                INSERT INTO legacy_references (
                    legacy_id, name, description, organism, created_at,
                    archived, restrict_source_types, source_types, user_id
                )
                VALUES
                    ('ref_a_legacy', 'Reference A', '', '', :now,
                     false, false, '[]'::jsonb, :user_id),
                    ('ref_b_legacy', 'Reference B', '', '', :now,
                     false, false, '[]'::jsonb, :user_id)
                RETURNING id, legacy_id
            """),
            {"now": now, "user_id": user_id},
        )
        reference_ids = {row.legacy_id: row.id for row in result}

        await session.execute(
            text("""
                INSERT INTO analyses (
                    legacy_id, created_at, updated_at, workflow, ready,
                    sample, reference, index, user_id
                )
                VALUES (
                    'analysis_a', :now, :now, 'pathoscope_bowtie', true,
                    'sample_a', 'ref_a_legacy', 'index_a', :user_id
                )
            """),
            {"now": now, "user_id": user_id},
        )

        await session.execute(
            text("""
                INSERT INTO legacy_history (
                    legacy_id, created_at, description, method_name,
                    user_id, otu, otu_name, reference
                )
                VALUES (
                    'otu_b.0', :now, 'Description', 'create',
                    :user_id, 'otu_b', 'OTU B', 'ref_b_legacy'
                )
            """),
            {"now": now, "user_id": user_id},
        )

        await session.commit()

    return reference_ids


class TestReferenceIdsBackfill:
    async def test_backfills_both_tables(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """The legacy ``reference`` string resolves to the integer FK on both the
        ``analyses`` and ``legacy_history`` tables.
        """
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            analysis_reference_id = (
                await session.execute(
                    text(
                        "SELECT reference_id FROM analyses "
                        "WHERE legacy_id = 'analysis_a'",
                    ),
                )
            ).scalar_one()

            history_reference_id = (
                await session.execute(
                    text(
                        "SELECT reference_id FROM legacy_history "
                        "WHERE legacy_id = 'otu_b.0'",
                    ),
                )
            ).scalar_one()

        assert analysis_reference_id == setup_references["ref_a_legacy"]
        assert history_reference_id == setup_references["ref_b_legacy"]

    async def test_idempotent(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """Re-running the backfill leaves already-resolved rows unchanged."""
        await upgrade(ctx)
        await upgrade(ctx)

        async with AsyncSession(ctx.pg) as session:
            analysis_reference_id = (
                await session.execute(
                    text(
                        "SELECT reference_id FROM analyses "
                        "WHERE legacy_id = 'analysis_a'",
                    ),
                )
            ).scalar_one()

        assert analysis_reference_id == setup_references["ref_a_legacy"]

    @pytest.mark.usefixtures("setup_references")
    async def test_unresolved_reference_raises(
        self,
        ctx: MigrationContext,
    ):
        """An analysis whose ``reference`` string matches no reference row raises
        rather than being left ``NULL``.
        """
        now = arrow.utcnow().naive

        async with AsyncSession(ctx.pg) as session:
            user_id = (
                await session.execute(
                    text("SELECT id FROM users WHERE legacy_id = 'alice_legacy'"),
                )
            ).scalar_one()

            await session.execute(
                text("""
                    INSERT INTO analyses (
                        legacy_id, created_at, updated_at, workflow, ready,
                        sample, reference, index, user_id
                    )
                    VALUES (
                        'analysis_orphan', :now, :now, 'pathoscope_bowtie', true,
                        'sample_orphan', 'ghost_reference', 'index_orphan', :user_id
                    )
                """),
                {"now": now, "user_id": user_id},
            )
            await session.commit()

        with pytest.raises(ValueError, match="ghost_reference"):
            await upgrade(ctx)
