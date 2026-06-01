"""Tests for the copy api keys to postgres migration."""

import asyncio
from collections.abc import Callable

import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from assets.revisions.rev_31su1xw351h2_copy_api_keys_to_postgres import upgrade
from virtool.migration.ctx import MigrationContext
from virtool.users.pg import SQLUser

REVISION = "12c20b71cffc"


async def create_user(ctx: MigrationContext, legacy_id: str | None = None) -> int:
    async with AsyncSession(ctx.pg) as session:
        user = SQLUser(
            handle="key_owner",
            legacy_id=legacy_id,
            password=b"",
            force_reset=False,
            last_password_change=arrow.utcnow().naive,
            settings={},
        )
        session.add(user)
        await session.flush()
        user_id = user.id
        await session.commit()

    return user_id


async def fetch_api_keys(ctx: MigrationContext) -> list[dict]:
    async with AsyncSession(ctx.pg) as session:
        rows = (
            (await session.execute(text("SELECT * FROM api_keys ORDER BY id")))
            .mappings()
            .all()
        )

    return [dict(row) for row in rows]


class TestUpgrade:
    async def test_backfills_from_mongo(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        user_id = await create_user(ctx)

        await ctx.mongo.keys.insert_many(
            [
                {
                    "_id": "hashed_one",
                    "id": "first_key_0",
                    "name": "First Key",
                    "created_at": arrow.get("2023-01-01T00:00:00Z").naive,
                    "groups": [],
                    "permissions": {"create_sample": True},
                    "user": {"id": user_id},
                },
                {
                    "_id": "hashed_two",
                    "id": "second_key_0",
                    "name": "Second Key",
                    "created_at": arrow.get("2023-02-01T00:00:00Z").naive,
                    "groups": [],
                    "permissions": {"modify_subtraction": True},
                    "user": {"id": user_id},
                },
            ],
        )

        await upgrade(ctx)

        api_keys = await fetch_api_keys(ctx)

        assert [(key["hashed"], key["name"], key["user_id"]) for key in api_keys] == [
            ("hashed_one", "First Key", user_id),
            ("hashed_two", "Second Key", user_id),
        ]
        assert api_keys[0]["permissions"] == {"create_sample": True}

        first = await ctx.mongo.keys.find_one({"_id": "hashed_one"})
        second = await ctx.mongo.keys.find_one({"_id": "hashed_two"})

        assert first["id"] == api_keys[0]["id"]
        assert second["id"] == api_keys[1]["id"]

    async def test_resolves_legacy_string_user_and_date(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        user_id = await create_user(ctx, legacy_id="bob")

        await ctx.mongo.keys.insert_one(
            {
                "_id": "hashed_one",
                "id": "first_key_0",
                "name": "First Key",
                "created_at": "2023-01-01T00:00:00Z",
                "groups": [],
                "permissions": {"create_sample": True},
                "user": {"id": "bob"},
            },
        )

        await upgrade(ctx)

        api_keys = await fetch_api_keys(ctx)

        assert len(api_keys) == 1
        assert api_keys[0]["user_id"] == user_id
        assert api_keys[0]["created_at"] == arrow.get("2023-01-01T00:00:00Z").naive

    async def test_no_keys_is_noop(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        await upgrade(ctx)

        assert await fetch_api_keys(ctx) == []

    async def test_idempotent(
        self,
        ctx: MigrationContext,
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, REVISION)

        user_id = await create_user(ctx)

        await ctx.mongo.keys.insert_one(
            {
                "_id": "hashed_one",
                "id": "first_key_0",
                "name": "First Key",
                "created_at": arrow.get("2023-01-01T00:00:00Z").naive,
                "groups": [],
                "permissions": {"create_sample": True},
                "user": {"id": user_id},
            },
        )

        await upgrade(ctx)
        first_pass = await fetch_api_keys(ctx)

        await upgrade(ctx)
        second_pass = await fetch_api_keys(ctx)

        assert len(first_pass) == 1
        assert second_pass == first_pass
