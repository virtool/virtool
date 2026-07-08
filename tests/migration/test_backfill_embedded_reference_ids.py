"""Tests for the backfill-embedded-reference-ids-to-integers migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_a5hg3lbp6rz1_backfill_embedded_reference_ids_to_integers import (
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


class TestEmbeddedReferenceIdsBackfill:
    async def test_backfills_all_collections(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """The embedded ``reference.id`` string resolves to the integer id on
        otu and sequence documents alike.
        """
        ref_a = setup_references["ref_a_legacy"]

        await ctx.mongo.otus.insert_one(
            {"_id": "otu_a", "reference": {"id": "ref_a_legacy"}},
        )
        await ctx.mongo.sequences.insert_one(
            {"_id": "sequence_a", "reference": {"id": "ref_a_legacy"}},
        )

        await upgrade(ctx)

        for collection, doc_id in (
            ("otus", "otu_a"),
            ("sequences", "sequence_a"),
        ):
            doc = await ctx.mongo[collection].find_one({"_id": doc_id})
            assert doc["reference"]["id"] == ref_a
            assert isinstance(doc["reference"]["id"], int)

    @pytest.mark.usefixtures("setup_references")
    async def test_leaves_history_untouched(
        self,
        ctx: MigrationContext,
    ):
        """The ``history`` collection is excluded, so an orphaned embedded
        ``reference.id`` left there by the orphan purge neither raises nor is
        rewritten.
        """
        await ctx.mongo.history.insert_one(
            {"_id": "otu_orphan.0", "reference": {"id": "orphaned_reference"}},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.history.find_one({"_id": "otu_orphan.0"})
        assert doc["reference"]["id"] == "orphaned_reference"

    async def test_leaves_other_reference_fields_intact(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """Only ``reference.id`` is rewritten; sibling reference fields survive."""
        await ctx.mongo.otus.insert_one(
            {
                "_id": "otu_a",
                "reference": {"id": "ref_a_legacy", "data_type": "genome"},
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.otus.find_one({"_id": "otu_a"})
        assert doc["reference"] == {
            "id": setup_references["ref_a_legacy"],
            "data_type": "genome",
        }

    async def test_already_int_passthrough(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """A document already holding an integer id is left untouched and does
        not need a matching ``legacy_references`` row.
        """
        ref_b = setup_references["ref_b_legacy"]

        await ctx.mongo.otus.insert_one(
            {"_id": "otu_int", "reference": {"id": ref_b}},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.otus.find_one({"_id": "otu_int"})
        assert doc["reference"]["id"] == ref_b

    async def test_idempotent(
        self,
        ctx: MigrationContext,
        setup_references: dict[str, int],
    ):
        """Re-running the backfill leaves already-resolved documents unchanged."""
        await ctx.mongo.otus.insert_one(
            {"_id": "otu_a", "reference": {"id": "ref_a_legacy"}},
        )

        await upgrade(ctx)
        await upgrade(ctx)

        doc = await ctx.mongo.otus.find_one({"_id": "otu_a"})
        assert doc["reference"]["id"] == setup_references["ref_a_legacy"]

    @pytest.mark.usefixtures("setup_references")
    async def test_unresolved_reference_raises(
        self,
        ctx: MigrationContext,
    ):
        """An OTU whose embedded ``reference.id`` matches no reference row raises
        rather than being silently dropped.
        """
        await ctx.mongo.otus.insert_one(
            {"_id": "otu_orphan", "reference": {"id": "ghost_reference"}},
        )

        with pytest.raises(ValueError, match="ghost_reference"):
            await upgrade(ctx)
