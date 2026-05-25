"""Tests for the add-uploads-user-id (phase 1) migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def setup_users(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict[str, int]:
    """Apply alembic up to the revision before this migration and seed two users.

    Returns a mapping of ``legacy_id`` → ``users.id`` for the seeded users.
    """
    await asyncio.to_thread(apply_alembic, "c3a7e9b4d1f2")

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


async def _insert_upload(ctx: MigrationContext, name: str, user_value: str) -> int:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO uploads (name, ready, removed, reserved, "user")
                VALUES (:name, false, false, false, :user)
                RETURNING id
            """),
            {"name": name, "user": user_value},
        )
        upload_id = result.scalar_one()
        await session.commit()
    return upload_id


async def _fetch_user_id(ctx: MigrationContext, upload_id: int) -> int | None:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("SELECT user_id FROM uploads WHERE id = :id"),
            {"id": upload_id},
        )
        return result.scalar_one()


class TestBackfill:
    async def test_resolves_digit_string_via_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        alice = setup_users["alice_legacy"]
        upload_id = await _insert_upload(ctx, "by_id.txt", str(alice))

        await asyncio.to_thread(apply_alembic, "head")

        assert await _fetch_user_id(ctx, upload_id) == alice

    async def test_resolves_non_digit_via_legacy_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        bob = setup_users["bob_legacy"]
        upload_id = await _insert_upload(ctx, "by_legacy.txt", "bob_legacy")

        await asyncio.to_thread(apply_alembic, "head")

        assert await _fetch_user_id(ctx, upload_id) == bob

    async def test_unmappable_row_raises(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        await _insert_upload(ctx, "orphan.txt", "ghost_user")

        with pytest.raises(RuntimeError, match="could not be mapped"):
            await asyncio.to_thread(apply_alembic, "head")


class TestTrigger:
    async def test_insert_resolves_digit_string(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, "head")

        alice = setup_users["alice_legacy"]
        upload_id = await _insert_upload(ctx, "post.txt", str(alice))

        assert await _fetch_user_id(ctx, upload_id) == alice

    async def test_insert_resolves_legacy_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, "head")

        bob = setup_users["bob_legacy"]
        upload_id = await _insert_upload(ctx, "post_legacy.txt", "bob_legacy")

        assert await _fetch_user_id(ctx, upload_id) == bob

    async def test_insert_with_null_user_preserves_user_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, "head")

        alice = setup_users["alice_legacy"]

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("""
                    INSERT INTO uploads (name, ready, removed, reserved, user_id)
                    VALUES ('phase2.txt', false, false, false, :user_id)
                    RETURNING id
                """),
                {"user_id": alice},
            )
            upload_id = result.scalar_one()
            await session.commit()

        assert await _fetch_user_id(ctx, upload_id) == alice

    async def test_update_user_column_updates_user_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        alice = setup_users["alice_legacy"]
        bob = setup_users["bob_legacy"]

        upload_id = await _insert_upload(ctx, "switch.txt", "alice_legacy")

        await asyncio.to_thread(apply_alembic, "head")

        assert await _fetch_user_id(ctx, upload_id) == alice

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text('UPDATE uploads SET "user" = :user WHERE id = :id'),
                {"user": str(bob), "id": upload_id},
            )
            await session.commit()

        assert await _fetch_user_id(ctx, upload_id) == bob
