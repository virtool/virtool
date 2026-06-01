"""Tests for the backfill-user-ids-to-integers migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_ie7r3vdaf5mu_backfill_user_ids_to_integers import upgrade
from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def setup_users_and_groups(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict[str, int]:
    """Apply alembic head and seed two users + two groups with legacy ids.

    Returns a mapping of legacy id -> Postgres id covering both users and
    groups (the keys do not collide in the test data).
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

        result = await session.execute(
            text("""
                INSERT INTO groups (legacy_id, name, permissions)
                VALUES
                    ('admins_legacy', 'admins', '{}'::jsonb),
                    ('readers_legacy', 'readers', '{}'::jsonb)
                RETURNING id, legacy_id
            """),
        )
        group_ids = {row.legacy_id: row.id for row in result}

        await session.commit()

    return {**user_ids, **group_ids}


class TestSimpleCollections:
    """``user.id`` rewrites for the flat-shaped collections."""

    @pytest.mark.parametrize(
        "collection_name",
        ["keys", "samples", "subtraction", "analyses", "otus", "history", "indexes"],
    )
    async def test_legacy_string_converts(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
        collection_name: str,
    ):
        await ctx.mongo[collection_name].insert_one(
            {"_id": "doc1", "user": {"id": "alice_legacy"}},
        )

        await upgrade(ctx)

        doc = await ctx.mongo[collection_name].find_one({"_id": "doc1"})
        assert doc["user"]["id"] == setup_users_and_groups["alice_legacy"]
        assert isinstance(doc["user"]["id"], int)

    async def test_already_int_passthrough(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
    ):
        pg_id = setup_users_and_groups["bob_legacy"]
        await ctx.mongo.samples.insert_one(
            {"_id": "s1", "user": {"id": pg_id}},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "s1"})
        assert doc["user"]["id"] == pg_id

    async def test_digit_string_coerces(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
    ):
        pg_id = setup_users_and_groups["alice_legacy"]
        await ctx.mongo.samples.insert_one(
            {"_id": "s2", "user": {"id": str(pg_id)}},
        )

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "s2"})
        assert doc["user"]["id"] == pg_id

    @pytest.mark.usefixtures("setup_users_and_groups")
    async def test_missing_user_field_is_skipped(
        self,
        ctx: MigrationContext,
    ):
        await ctx.mongo.samples.insert_one({"_id": "no_user"})

        await upgrade(ctx)

        doc = await ctx.mongo.samples.find_one({"_id": "no_user"})
        assert "user" not in doc

    @pytest.mark.usefixtures("setup_users_and_groups")
    async def test_unmapped_legacy_raises(
        self,
        ctx: MigrationContext,
    ):
        await ctx.mongo.samples.insert_one(
            {"_id": "orphan", "user": {"id": "ghost_user"}},
        )

        with pytest.raises(ValueError, match="ghost_user"):
            await upgrade(ctx)


class TestReferences:
    """The ``references`` collection has both ``user.id`` and ``users[].id``."""

    async def test_both_user_and_users_array_convert(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
    ):
        alice = setup_users_and_groups["alice_legacy"]
        bob = setup_users_and_groups["bob_legacy"]

        await ctx.mongo.references.insert_one(
            {
                "_id": "ref1",
                "user": {"id": "alice_legacy"},
                "users": [
                    {"id": "alice_legacy", "build": True},
                    {"id": "bob_legacy", "build": False},
                ],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.references.find_one({"_id": "ref1"})
        assert doc["user"]["id"] == alice
        assert [u["id"] for u in doc["users"]] == [alice, bob]
        assert doc["users"][0]["build"] is True
        assert doc["users"][1]["build"] is False

    async def test_already_int_unchanged(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
    ):
        alice = setup_users_and_groups["alice_legacy"]

        await ctx.mongo.references.insert_one(
            {
                "_id": "ref2",
                "user": {"id": alice},
                "users": [{"id": alice, "build": True}],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.references.find_one({"_id": "ref2"})
        assert doc["user"]["id"] == alice
        assert doc["users"][0]["id"] == alice


class TestUsersGroups:
    """The Mongo ``users`` collection has a ``groups[]`` list of group ids."""

    async def test_legacy_string_groups_convert(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
    ):
        admins = setup_users_and_groups["admins_legacy"]
        readers = setup_users_and_groups["readers_legacy"]

        await ctx.mongo.users.insert_one(
            {
                "_id": "alice_legacy",
                "groups": ["admins_legacy", "readers_legacy"],
            },
        )

        await upgrade(ctx)

        doc = await ctx.mongo.users.find_one({"_id": "alice_legacy"})
        assert doc["groups"] == [admins, readers]

    async def test_unmapped_group_raises(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
    ):
        await ctx.mongo.users.insert_one(
            {
                "_id": "orphan_user",
                "groups": ["admins_legacy", "ghost_group"],
            },
        )

        with pytest.raises(ValueError, match="ghost_group"):
            await upgrade(ctx)

    async def test_missing_groups_field_skipped(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
    ):
        await ctx.mongo.users.insert_one({"_id": "no_groups"})

        await upgrade(ctx)

        doc = await ctx.mongo.users.find_one({"_id": "no_groups"})
        assert "groups" not in doc


class TestIdempotent:
    async def test_second_run_is_noop(
        self,
        ctx: MigrationContext,
        setup_users_and_groups: dict[str, int],
    ):
        alice = setup_users_and_groups["alice_legacy"]
        admins = setup_users_and_groups["admins_legacy"]

        await ctx.mongo.samples.insert_one(
            {"_id": "s1", "user": {"id": "alice_legacy"}},
        )
        await ctx.mongo.references.insert_one(
            {
                "_id": "ref1",
                "user": {"id": "alice_legacy"},
                "users": [{"id": "alice_legacy"}],
            },
        )
        await ctx.mongo.users.insert_one(
            {"_id": "alice_legacy", "groups": ["admins_legacy"]},
        )

        await upgrade(ctx)
        await upgrade(ctx)

        sample = await ctx.mongo.samples.find_one({"_id": "s1"})
        ref = await ctx.mongo.references.find_one({"_id": "ref1"})
        user_doc = await ctx.mongo.users.find_one({"_id": "alice_legacy"})

        assert sample["user"]["id"] == alice
        assert ref["user"]["id"] == alice
        assert ref["users"][0]["id"] == alice
        assert user_doc["groups"] == [admins]
