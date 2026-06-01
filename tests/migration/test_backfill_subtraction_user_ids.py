"""Tests for the backfill-subtraction-user-ids migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_x602yxtuaeg5_backfill_subtraction_user_ids import upgrade
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def setup_users(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict[str, int]:
    """Apply alembic head and seed two users with legacy ids."""
    await asyncio.to_thread(apply_alembic, "head")

    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO users (
                    handle, legacy_id, active, email, force_reset,
                    invalidate_sessions, last_password_change, password, settings
                )
                VALUES
                    ('alice', 'alice_legacy', true, '',
                     false, false, :now, :pw, '{}'::jsonb),
                    ('bob', 'bob_legacy', true, '',
                     false, false, :now, :pw, '{}'::jsonb)
                RETURNING id, legacy_id
            """),
            {"now": arrow.utcnow().naive, "pw": b"hashed"},
        )
        user_ids = {row.legacy_id: row.id for row in result}

        await session.commit()

    return user_ids


class TestSubtractionBackfill:
    async def test_legacy_string_converts(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
    ):
        await ctx.mongo.subtraction.insert_one(
            {"_id": "sub1", "user": {"id": "alice_legacy"}},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.subtraction.find_one({"_id": "sub1"})
        assert doc["user"]["id"] == setup_users["alice_legacy"]
        assert isinstance(doc["user"]["id"], int)

    async def test_already_int_passthrough(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
    ):
        pg_id = setup_users["bob_legacy"]
        await ctx.mongo.subtraction.insert_one({"_id": "sub2", "user": {"id": pg_id}})

        await upgrade(ctx)

        doc = await ctx.mongo.subtraction.find_one({"_id": "sub2"})
        assert doc["user"]["id"] == pg_id

    @pytest.mark.usefixtures("setup_users")
    async def test_unmapped_legacy_raises(
        self,
        ctx: MigrationContext,
    ):
        await ctx.mongo.subtraction.insert_one(
            {"_id": "orphan", "user": {"id": "ghost_user"}},
        )

        with pytest.raises(ValueError, match="ghost_user"):
            await upgrade(ctx)
