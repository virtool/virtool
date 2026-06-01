"""Tests for the backfill-nested-user-ids migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_6k51od8ta28a_backfill_nested_user_ids_in_status_and_references import (  # noqa: E501
    upgrade,
)
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def setup_users(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict[str, int]:
    """Apply alembic head and seed two users with legacy ids.

    Returns a mapping of legacy id -> Postgres id.
    """
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


class TestStatusHMM:
    """Nested ``user.id`` rewrites for the ``status`` collection's ``hmm`` doc."""

    async def test_installed_and_updates_convert(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
    ):
        alice = setup_users["alice_legacy"]
        bob = setup_users["bob_legacy"]

        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "installed": {"id": 0, "user": {"id": "alice_legacy"}},
                "updates": [
                    {"id": 0, "ready": True, "user": {"id": "alice_legacy"}},
                    {"id": 1, "ready": False, "user": {"id": "bob_legacy"}},
                ],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.status.find_one({"_id": "hmm"})
        assert doc["installed"]["user"]["id"] == alice
        assert isinstance(doc["installed"]["user"]["id"], int)
        assert [u["user"]["id"] for u in doc["updates"]] == [alice, bob]
        assert doc["updates"][0]["ready"] is True
        assert doc["updates"][1]["ready"] is False

    async def test_already_int_unchanged(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
    ):
        alice = setup_users["alice_legacy"]

        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "installed": {"id": 0, "user": {"id": alice}},
                "updates": [{"id": 0, "user": {"id": alice}}],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.status.find_one({"_id": "hmm"})
        assert doc["installed"]["user"]["id"] == alice
        assert doc["updates"][0]["user"]["id"] == alice

    async def test_digit_string_coerces(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
    ):
        alice = setup_users["alice_legacy"]

        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "installed": {"id": 0, "user": {"id": str(alice)}},
                "updates": [],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.status.find_one({"_id": "hmm"})
        assert doc["installed"]["user"]["id"] == alice

    @pytest.mark.usefixtures("setup_users")
    async def test_null_installed_is_skipped(
        self,
        ctx: MigrationContext,
    ):
        await ctx.mongo.status.insert_one(
            {"_id": "hmm", "installed": None, "updates": []},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.status.find_one({"_id": "hmm"})
        assert doc["installed"] is None

    @pytest.mark.usefixtures("setup_users")
    async def test_unrelated_status_doc_is_skipped(
        self,
        ctx: MigrationContext,
    ):
        await ctx.mongo.status.insert_one({"_id": "software", "version": "1.0.0"})

        await upgrade(ctx)

        doc = await ctx.mongo.status.find_one({"_id": "software"})
        assert doc == {"_id": "software", "version": "1.0.0"}

    @pytest.mark.usefixtures("setup_users")
    async def test_unmapped_legacy_raises(
        self,
        ctx: MigrationContext,
    ):
        await ctx.mongo.status.insert_one(
            {
                "_id": "hmm",
                "installed": {"id": 0, "user": {"id": "ghost_user"}},
                "updates": [],
            },
        )

        with pytest.raises(ValueError, match="ghost_user"):
            await upgrade(ctx)


class TestReferences:
    """Nested ``user.id`` rewrites for ``references`` ``installed``/``updates``."""

    async def test_installed_and_updates_convert(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
    ):
        alice = setup_users["alice_legacy"]
        bob = setup_users["bob_legacy"]

        await ctx.mongo.references.insert_one(
            {
                "_id": "ref1",
                "installed": {"id": 0, "user": {"id": "alice_legacy"}},
                "updates": [
                    {"id": 0, "user": {"id": "alice_legacy"}},
                    {"id": 1, "user": {"id": "bob_legacy"}},
                ],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.references.find_one({"_id": "ref1"})
        assert doc["installed"]["user"]["id"] == alice
        assert [u["user"]["id"] for u in doc["updates"]] == [alice, bob]

    async def test_already_int_unchanged(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
    ):
        alice = setup_users["alice_legacy"]

        await ctx.mongo.references.insert_one(
            {
                "_id": "ref2",
                "installed": {"id": 0, "user": {"id": alice}},
                "updates": [{"id": 0, "user": {"id": alice}}],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.references.find_one({"_id": "ref2"})
        assert doc["installed"]["user"]["id"] == alice
        assert doc["updates"][0]["user"]["id"] == alice
