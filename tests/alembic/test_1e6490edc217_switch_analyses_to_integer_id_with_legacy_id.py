import asyncio
from collections.abc import Callable
from pathlib import Path

import alembic.command
import alembic.config
import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession


def _downgrade(revision: str) -> None:
    alembic.command.downgrade(
        alembic.config.Config(
            Path(__file__).parent.parent.parent / "alembic.ini",
        ),
        revision,
    )


async def _insert_user(session: AsyncSession) -> int:
    result = await session.execute(
        text(
            """
            INSERT INTO users (
                handle, active, email, force_reset, invalidate_sessions,
                last_password_change, password, settings
            )
            VALUES (
                'creator', true, '', false, false, :now, :password, '{}'::jsonb
            )
            RETURNING id
            """,
        ),
        {"now": arrow.utcnow().naive, "password": b"hashed"},
    )

    return result.scalar_one()


async def _insert_analysis(session: AsyncSession, legacy_id: str, user_id: int) -> None:
    await session.execute(
        text(
            """
            INSERT INTO analyses (
                id, created_at, updated_at, workflow, ready, results,
                sample, reference, "index", subtractions, user_id
            )
            VALUES (
                :id, :now, :now, 'nuvs', false, NULL,
                'sample', 'reference', 'index', '[]'::jsonb, :user_id
            )
            """,
        ),
        {"id": legacy_id, "now": arrow.utcnow().naive, "user_id": user_id},
    )


async def test_upgrade_preserves_rows_and_assigns_integer_ids(
    apply_alembic: Callable,
    migration_pg: AsyncEngine,
):
    """Rows dual-written under the string ``id`` schema survive the swap to an
    integer surrogate ``id`` with their Mongo ids preserved in ``legacy_id``.
    """
    await asyncio.to_thread(apply_alembic, "7ea2f370163c")

    async with AsyncSession(migration_pg) as session:
        user_id = await _insert_user(session)
        await _insert_analysis(session, "analysis_alpha", user_id)
        await _insert_analysis(session, "analysis_beta", user_id)
        await session.commit()

    await asyncio.to_thread(apply_alembic, "1e6490edc217")

    async with AsyncSession(migration_pg) as session:
        rows = (
            await session.execute(
                text("SELECT id, legacy_id FROM analyses ORDER BY legacy_id"),
            )
        ).all()

    assert [legacy_id for _, legacy_id in rows] == ["analysis_alpha", "analysis_beta"]
    assert all(isinstance(id_, int) for id_, _ in rows)
    assert len({id_ for id_, _ in rows}) == 2


async def test_upgrade_then_insert_autoincrements_id(
    apply_alembic: Callable,
    migration_pg: AsyncEngine,
):
    """After the swap a new row gets an integer ``id`` from the identity sequence
    without supplying one.
    """
    await asyncio.to_thread(apply_alembic, "7ea2f370163c")

    async with AsyncSession(migration_pg) as session:
        user_id = await _insert_user(session)
        await _insert_analysis(session, "analysis_existing", user_id)
        await session.commit()

    await asyncio.to_thread(apply_alembic, "1e6490edc217")

    async with AsyncSession(migration_pg) as session:
        new_id = (
            await session.execute(
                text(
                    """
                    INSERT INTO analyses (
                        legacy_id, created_at, updated_at, workflow, ready,
                        sample, reference, "index", subtractions, user_id
                    )
                    SELECT
                        'analysis_new', now(), now(), 'nuvs', false,
                        'sample', 'reference', 'index', '[]'::jsonb, id
                    FROM users LIMIT 1
                    RETURNING id
                    """,
                ),
            )
        ).scalar_one()

        await session.commit()

    assert isinstance(new_id, int)


async def test_downgrade_restores_string_id(
    apply_alembic: Callable,
    migration_pg: AsyncEngine,
):
    """Downgrading folds ``legacy_id`` back into a string ``id`` primary key."""
    await asyncio.to_thread(apply_alembic, "7ea2f370163c")

    async with AsyncSession(migration_pg) as session:
        user_id = await _insert_user(session)
        await _insert_analysis(session, "analysis_alpha", user_id)
        await session.commit()

    await asyncio.to_thread(apply_alembic, "1e6490edc217")
    await asyncio.to_thread(_downgrade, "7ea2f370163c")

    async with AsyncSession(migration_pg) as session:
        ids = (await session.execute(text("SELECT id FROM analyses"))).scalars().all()

    assert ids == ["analysis_alpha"]
