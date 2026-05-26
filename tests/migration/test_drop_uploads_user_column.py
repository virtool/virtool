"""Tests for the drop-uploads-user-column (phase 3) migration."""

import asyncio
from collections.abc import Callable

import arrow
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.migration.ctx import MigrationContext


@pytest.fixture
async def setup_phase_2(
    ctx: MigrationContext,
    apply_alembic: Callable,
) -> dict[str, int]:
    """Apply alembic up to the Phase 1 head and seed two users.

    This leaves the database in the state Phase 2 expects: both columns
    present, the ``uploads_sync_user_id`` trigger installed, and any
    inserted rows backfilled with ``user_id``.

    Returns a mapping of ``legacy_id`` → ``users.id`` for the seeded users.
    """
    await asyncio.to_thread(apply_alembic, "d7f8f4569939")

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


async def _insert_upload_via_trigger(
    ctx: MigrationContext, name: str, user_value: str
) -> int:
    """Insert via the legacy ``"user"`` column; the Phase 1 trigger fills ``user_id``."""
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


class TestSchemaCleanup:
    async def test_trigger_is_dropped(
        self,
        ctx: MigrationContext,
        setup_phase_2: dict[str, int],
        apply_alembic: Callable,
    ):
        async with AsyncSession(ctx.pg) as session:
            before = (
                await session.execute(
                    text("""
                        SELECT COUNT(*) FROM pg_trigger
                        WHERE tgname = 'uploads_sync_user_id'
                          AND NOT tgisinternal
                    """),
                )
            ).scalar_one()
            assert before == 1

        await asyncio.to_thread(apply_alembic, "head")

        async with AsyncSession(ctx.pg) as session:
            after = (
                await session.execute(
                    text("""
                        SELECT COUNT(*) FROM pg_trigger
                        WHERE tgname = 'uploads_sync_user_id'
                          AND NOT tgisinternal
                    """),
                )
            ).scalar_one()
            assert after == 0

            function_count = (
                await session.execute(
                    text("""
                        SELECT COUNT(*) FROM pg_proc
                        WHERE proname = 'sync_uploads_user_id'
                    """),
                )
            ).scalar_one()
            assert function_count == 0

    async def test_user_column_is_dropped(
        self,
        ctx: MigrationContext,
        setup_phase_2: dict[str, int],
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, "head")

        async with AsyncSession(ctx.pg) as session:
            column_count = (
                await session.execute(
                    text("""
                        SELECT COUNT(*) FROM information_schema.columns
                        WHERE table_name = 'uploads' AND column_name = 'user'
                    """),
                )
            ).scalar_one()
            assert column_count == 0

    async def test_user_id_is_not_null(
        self,
        ctx: MigrationContext,
        setup_phase_2: dict[str, int],
        apply_alembic: Callable,
    ):
        await asyncio.to_thread(apply_alembic, "head")

        async with AsyncSession(ctx.pg) as session:
            is_nullable = (
                await session.execute(
                    text("""
                        SELECT is_nullable FROM information_schema.columns
                        WHERE table_name = 'uploads' AND column_name = 'user_id'
                    """),
                )
            ).scalar_one()
            assert is_nullable == "NO"

    async def test_existing_rows_survive(
        self,
        ctx: MigrationContext,
        setup_phase_2: dict[str, int],
        apply_alembic: Callable,
    ):
        alice = setup_phase_2["alice_legacy"]
        upload_id = await _insert_upload_via_trigger(
            ctx, "alice_upload.txt", str(alice)
        )

        await asyncio.to_thread(apply_alembic, "head")

        async with AsyncSession(ctx.pg) as session:
            user_id = (
                await session.execute(
                    text("SELECT user_id FROM uploads WHERE id = :id"),
                    {"id": upload_id},
                )
            ).scalar_one()
            assert user_id == alice


class TestTripwire:
    async def test_null_user_id_raises(
        self,
        ctx: MigrationContext,
        setup_phase_2: dict[str, int],
        apply_alembic: Callable,
    ):
        async with AsyncSession(ctx.pg) as session:
            await session.execute(text("ALTER TABLE uploads DISABLE TRIGGER ALL"))
            await session.execute(
                text("""
                    INSERT INTO uploads (name, ready, removed, reserved)
                    VALUES ('orphan.txt', false, false, false)
                """),
            )
            await session.execute(text("ALTER TABLE uploads ENABLE TRIGGER ALL"))
            await session.commit()

        with pytest.raises(RuntimeError, match="NULL user_id"):
            await asyncio.to_thread(apply_alembic, "head")
