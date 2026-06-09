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


async def _insert_session(
    session: AsyncSession,
    session_id: str,
    session_type: str,
) -> None:
    await session.execute(
        text(
            "INSERT INTO sessions "
            "(session_id, ip, created_at, expires_at, session_type) "
            "VALUES (:session_id, '127.0.0.1', now(), now(), :session_type)",
        ),
        {"session_id": session_id, "session_type": session_type},
    )


async def test_upgrade(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    await asyncio.to_thread(apply_alembic, "869aa923399e")

    async with AsyncSession(migration_pg) as session:
        await _insert_session(session, "anonymous_session", "anonymous")
        await _insert_session(session, "authenticated_session", "authenticated")
        await _insert_session(session, "reset_session", "reset")
        await session.commit()

    await asyncio.to_thread(apply_alembic, "90330f98cf4e")

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        result = await session.execute(
            text("SELECT session_id, session_type FROM sessions ORDER BY session_id"),
        )
        assert result.all() == [
            ("anonymous_session", "anonymous"),
            ("authenticated_session", "authenticated"),
            ("reset_session", "reset"),
        ]

        column_type = await session.execute(
            text(
                "SELECT data_type FROM information_schema.columns "
                "WHERE table_name = 'sessions' AND column_name = 'session_type'",
            ),
        )
        assert column_type.scalar_one() == "text"

    with pytest.raises(IntegrityError):
        async with AsyncSession(migration_pg) as session:
            await _insert_session(session, "invalid_session", "bogus")
            await session.commit()


async def test_downgrade(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    await asyncio.to_thread(apply_alembic, "90330f98cf4e")

    async with AsyncSession(migration_pg) as session:
        await _insert_session(session, "anonymous_session", "anonymous")
        await _insert_session(session, "authenticated_session", "authenticated")
        await _insert_session(session, "reset_session", "reset")
        await session.commit()

    await asyncio.to_thread(_downgrade, "869aa923399e")

    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        result = await session.execute(
            text("SELECT session_id, session_type FROM sessions ORDER BY session_id"),
        )
        assert result.all() == [
            ("anonymous_session", "anonymous"),
            ("authenticated_session", "authenticated"),
            ("reset_session", "reset"),
        ]

        column_type = await session.execute(
            text(
                "SELECT udt_name FROM information_schema.columns "
                "WHERE table_name = 'sessions' AND column_name = 'session_type'",
            ),
        )
        assert column_type.scalar_one() == "session_type_enum"
