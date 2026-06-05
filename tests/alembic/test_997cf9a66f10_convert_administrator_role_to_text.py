import asyncio
from pathlib import Path

import alembic.command
import alembic.config
import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession


def _downgrade(revision: str) -> None:
    """Downgrade to ``revision`` using the SQLALCHEMY_URL set by ``apply_alembic``."""
    alembic.command.downgrade(
        alembic.config.Config(Path(__file__).parent.parent.parent / "alembic.ini"),
        revision,
    )


async def _insert_user(
    session: AsyncSession,
    handle: str,
    administrator_role: str | None,
) -> None:
    await session.execute(
        text(
            "INSERT INTO users "
            "(active, administrator_role, email, force_reset, handle, "
            "invalidate_sessions, last_password_change, password, settings) "
            "VALUES (true, :role, '', false, :handle, false, now(), "
            r"'\x00'::bytea, '{}'::jsonb)",
        ),
        {"role": administrator_role, "handle": handle},
    )


async def test_upgrade(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    await asyncio.to_thread(apply_alembic, "840040ca7266")

    async with AsyncSession(migration_pg) as session:
        await _insert_user(session, "spaces_admin", "spaces")
        await _insert_user(session, "full_admin", "full")
        await _insert_user(session, "regular", None)
        await session.commit()

    await asyncio.to_thread(apply_alembic, "997cf9a66f10")

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        result = await session.execute(
            text("SELECT handle, administrator_role FROM users ORDER BY handle"),
        )
        assert result.all() == [
            ("full_admin", "full"),
            ("regular", None),
            ("spaces_admin", "base"),
        ]

        column_type = await session.execute(
            text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name = 'users' AND column_name = 'administrator_role'",
            ),
        )
        assert column_type.scalar_one() == "text"

    with pytest.raises(IntegrityError):
        async with AsyncSession(migration_pg) as session:
            await _insert_user(session, "invalid_admin", "spaces")
            await session.commit()


async def test_downgrade(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    await asyncio.to_thread(apply_alembic, "997cf9a66f10")

    async with AsyncSession(migration_pg) as session:
        await _insert_user(session, "full_admin", "full")
        await _insert_user(session, "settings_admin", "settings")
        await _insert_user(session, "users_admin", "users")
        await _insert_user(session, "base_admin", "base")
        await _insert_user(session, "regular", None)
        await session.commit()

    await asyncio.to_thread(_downgrade, "840040ca7266")

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        result = await session.execute(
            text("SELECT handle, administrator_role FROM users ORDER BY handle"),
        )
        assert result.all() == [
            ("base_admin", "base"),
            ("full_admin", "full"),
            ("regular", None),
            ("settings_admin", "settings"),
            ("users_admin", "users"),
        ]

        column_type = await session.execute(
            text(
                "SELECT udt_name FROM information_schema.columns "
                "WHERE table_name = 'users' AND column_name = 'administrator_role'",
            ),
        )
        assert column_type.scalar_one() == "administratorrole"
