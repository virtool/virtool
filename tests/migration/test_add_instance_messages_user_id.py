"""Tests for the add-instance-messages-user-id (phase 1) migration."""

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
    await asyncio.to_thread(apply_alembic, "a4f9c1e82b56")

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


async def _insert_message(ctx: MigrationContext, message: str, user_value: str) -> int:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("""
                INSERT INTO instance_messages (active, color, message, "user")
                VALUES (false, 'blue', :message, :user)
                RETURNING id
            """),
            {"message": message, "user": user_value},
        )
        message_id = result.scalar_one()
        await session.commit()
    return message_id


async def _fetch_user_id(ctx: MigrationContext, message_id: int) -> int | None:
    async with AsyncSession(ctx.pg) as session:
        result = await session.execute(
            text("SELECT user_id FROM instance_messages WHERE id = :id"),
            {"id": message_id},
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
        message_id = await _insert_message(ctx, "by id", str(alice))

        await asyncio.to_thread(apply_alembic, "c24b524f77e3")

        assert await _fetch_user_id(ctx, message_id) == alice

    async def test_resolves_non_digit_via_legacy_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        bob = setup_users["bob_legacy"]
        message_id = await _insert_message(ctx, "by legacy", "bob_legacy")

        await asyncio.to_thread(apply_alembic, "c24b524f77e3")

        assert await _fetch_user_id(ctx, message_id) == bob

    async def test_unmappable_row_raises(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        await _insert_message(ctx, "orphan", "ghost_user")

        with pytest.raises(RuntimeError, match="could not be mapped"):
            await asyncio.to_thread(apply_alembic, "c24b524f77e3")


class TestTrigger:
    async def test_insert_resolves_digit_string(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, "c24b524f77e3")

        alice = setup_users["alice_legacy"]
        message_id = await _insert_message(ctx, "post", str(alice))

        assert await _fetch_user_id(ctx, message_id) == alice

    async def test_insert_resolves_legacy_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, "c24b524f77e3")

        bob = setup_users["bob_legacy"]
        message_id = await _insert_message(ctx, "post legacy", "bob_legacy")

        assert await _fetch_user_id(ctx, message_id) == bob

    async def test_insert_with_null_user_preserves_user_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, "c24b524f77e3")

        alice = setup_users["alice_legacy"]

        async with AsyncSession(ctx.pg) as session:
            result = await session.execute(
                text("""
                    INSERT INTO instance_messages (active, color, message, user_id)
                    VALUES (false, 'blue', 'phase2', :user_id)
                    RETURNING id
                """),
                {"user_id": alice},
            )
            message_id = result.scalar_one()
            await session.commit()

        assert await _fetch_user_id(ctx, message_id) == alice

    async def test_update_user_column_updates_user_id(
        self,
        ctx: MigrationContext,
        setup_users: dict[str, int],
        apply_alembic: Callable,
    ):
        alice = setup_users["alice_legacy"]
        bob = setup_users["bob_legacy"]

        message_id = await _insert_message(ctx, "switch", "alice_legacy")

        await asyncio.to_thread(apply_alembic, "c24b524f77e3")

        assert await _fetch_user_id(ctx, message_id) == alice

        async with AsyncSession(ctx.pg) as session:
            await session.execute(
                text(
                    'UPDATE instance_messages SET "user" = :user WHERE id = :id',
                ),
                {"user": str(bob), "id": message_id},
            )
            await session.commit()

        assert await _fetch_user_id(ctx, message_id) == bob
