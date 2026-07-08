"""Tests for the backfill-embedded-index-reference-ids-to-integers migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_tr3p2obxndjm_backfill_embedded_index_reference_ids_to_integers import (
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

        await session.commit()

    return reference_ids


class TestEmbeddedIndexReferenceIdsBackfill:
    async def test_backfills_indexes(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """The embedded ``reference.id`` string resolves to the integer id on
        index documents.
        """
        ref_a = setup_references["ref_a_legacy"]

        await ctx.mongo.indexes.insert_one(
            {"_id": "index_a", "reference": {"id": "ref_a_legacy"}},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.indexes.find_one({"_id": "index_a"})
        assert doc["reference"]["id"] == ref_a
        assert isinstance(doc["reference"]["id"], int)

    async def test_leaves_other_reference_fields_intact(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """Only ``reference.id`` is rewritten; sibling reference fields survive."""
        await ctx.mongo.indexes.insert_one(
            {
                "_id": "index_a",
                "reference": {"id": "ref_a_legacy", "data_type": "genome"},
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.indexes.find_one({"_id": "index_a"})
        assert doc["reference"] == {
            "id": setup_references["ref_a_legacy"],
            "data_type": "genome",
        }

    async def test_already_int_passthrough(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """An index already holding an integer id is left untouched and does not
        need a matching ``legacy_references`` row.
        """
        ref_b = setup_references["ref_b_legacy"]

        await ctx.mongo.indexes.insert_one(
            {"_id": "index_int", "reference": {"id": ref_b}},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.indexes.find_one({"_id": "index_int"})
        assert doc["reference"]["id"] == ref_b

    async def test_idempotent(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """Re-running the backfill leaves already-resolved documents unchanged."""
        await ctx.mongo.indexes.insert_one(
            {"_id": "index_a", "reference": {"id": "ref_a_legacy"}},
        )

        await upgrade(ctx)
        await upgrade(ctx)

        doc = await ctx.mongo.indexes.find_one({"_id": "index_a"})
        assert doc["reference"]["id"] == setup_references["ref_a_legacy"]

    @pytest.mark.usefixtures("setup_references")
    async def test_unresolved_reference_raises(
        self,
        ctx: MigrationContext,
    ):
        """An index whose embedded ``reference.id`` matches no reference row raises
        rather than being silently dropped.
        """
        await ctx.mongo.indexes.insert_one(
            {"_id": "index_orphan", "reference": {"id": "ghost_reference"}},
        )

        with pytest.raises(ValueError, match="ghost_reference"):
            await upgrade(ctx)
