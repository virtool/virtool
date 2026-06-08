import asyncio
from collections.abc import Callable
from pathlib import Path

import alembic.command
import alembic.config
import arrow
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

DOWN_REVISION = "997cf9a66f10"
REVISION = "f51a03fa6f9a"


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


async def _insert_analysis(session: AsyncSession, legacy_id: str, user_id: int) -> int:
    result = await session.execute(
        text(
            """
            INSERT INTO analyses (
                legacy_id, created_at, updated_at, workflow, ready, results,
                sample, reference, "index", subtractions, user_id
            )
            VALUES (
                :legacy_id, :now, :now, 'nuvs', false, NULL,
                'sample', 'reference', 'index', '[]'::jsonb, :user_id
            )
            RETURNING id
            """,
        ),
        {"legacy_id": legacy_id, "now": arrow.utcnow().naive, "user_id": user_id},
    )

    return result.scalar_one()


async def _insert_analysis_file(session: AsyncSession, analysis_slug: str) -> None:
    await session.execute(
        text(
            """
            INSERT INTO analysis_files (analysis, format, name, name_on_disk)
            VALUES (:analysis, 'fasta', 'report.fa', :name_on_disk)
            """,
        ),
        {"analysis": analysis_slug, "name_on_disk": f"{analysis_slug}-report.fa"},
    )


async def _insert_nuvs_blast(
    session: AsyncSession,
    analysis_slug: str,
    sequence_index: int,
) -> None:
    await session.execute(
        text(
            """
            INSERT INTO nuvs_blast (
                analysis_id, sequence_index, created_at, updated_at,
                last_checked_at, ready
            )
            VALUES (:analysis_id, :sequence_index, :now, :now, :now, false)
            """,
        ),
        {
            "analysis_id": analysis_slug,
            "sequence_index": sequence_index,
            "now": arrow.utcnow().naive,
        },
    )


async def test_upgrade_backfills_integer_fks(
    apply_alembic: Callable,
    migration_pg: AsyncEngine,
):
    """Slug references are rewritten to the integer ``analyses.id`` on upgrade."""
    await asyncio.to_thread(apply_alembic, DOWN_REVISION)

    async with AsyncSession(migration_pg) as session:
        user_id = await _insert_user(session)
        analysis_id = await _insert_analysis(session, "alpha", user_id)
        await _insert_analysis_file(session, "alpha")
        await _insert_nuvs_blast(session, "alpha", 5)
        await session.commit()

    await asyncio.to_thread(apply_alembic, REVISION)

    async with AsyncSession(migration_pg) as session:
        file_analysis_id = (
            await session.execute(text("SELECT analysis_id FROM analysis_files"))
        ).scalar_one()
        blast_analysis_id = (
            await session.execute(text("SELECT analysis_id FROM nuvs_blast"))
        ).scalar_one()

    assert file_analysis_id == analysis_id
    assert blast_analysis_id == analysis_id


async def test_upgrade_deletes_orphan_analysis_file(
    apply_alembic: Callable,
    migration_pg: AsyncEngine,
):
    """An ``analysis_files`` row whose slug resolves to no analysis is deleted."""
    await asyncio.to_thread(apply_alembic, DOWN_REVISION)

    async with AsyncSession(migration_pg) as session:
        await _insert_analysis_file(session, "orphan")
        await session.commit()

    await asyncio.to_thread(apply_alembic, REVISION)

    async with AsyncSession(migration_pg) as session:
        file_count = (
            await session.execute(text("SELECT count(*) FROM analysis_files"))
        ).scalar_one()

    assert file_count == 0


async def test_upgrade_deletes_orphan_nuvs_blast(
    apply_alembic: Callable,
    migration_pg: AsyncEngine,
):
    """A ``nuvs_blast`` row whose slug resolves to no analysis is deleted."""
    await asyncio.to_thread(apply_alembic, DOWN_REVISION)

    async with AsyncSession(migration_pg) as session:
        await _insert_nuvs_blast(session, "orphan", 1)
        await session.commit()

    await asyncio.to_thread(apply_alembic, REVISION)

    async with AsyncSession(migration_pg) as session:
        blast_count = (
            await session.execute(text("SELECT count(*) FROM nuvs_blast"))
        ).scalar_one()

    assert blast_count == 0


async def test_cascade_delete_removes_dependents(
    apply_alembic: Callable,
    migration_pg: AsyncEngine,
):
    """Deleting an analysis cascades to its files and BLAST records."""
    await asyncio.to_thread(apply_alembic, DOWN_REVISION)

    async with AsyncSession(migration_pg) as session:
        user_id = await _insert_user(session)
        analysis_id = await _insert_analysis(session, "alpha", user_id)
        await _insert_analysis_file(session, "alpha")
        await _insert_nuvs_blast(session, "alpha", 5)
        await session.commit()

    await asyncio.to_thread(apply_alembic, REVISION)

    async with AsyncSession(migration_pg) as session:
        await session.execute(
            text("DELETE FROM analyses WHERE id = :id"),
            {"id": analysis_id},
        )
        await session.commit()

    async with AsyncSession(migration_pg) as session:
        file_count = (
            await session.execute(text("SELECT count(*) FROM analysis_files"))
        ).scalar_one()
        blast_count = (
            await session.execute(text("SELECT count(*) FROM nuvs_blast"))
        ).scalar_one()

    assert file_count == 0
    assert blast_count == 0


async def test_downgrade_restores_slugs(
    apply_alembic: Callable,
    migration_pg: AsyncEngine,
):
    """Downgrading rewrites the integer foreign keys back to the legacy slug."""
    await asyncio.to_thread(apply_alembic, DOWN_REVISION)

    async with AsyncSession(migration_pg) as session:
        user_id = await _insert_user(session)
        await _insert_analysis(session, "alpha", user_id)
        await _insert_analysis_file(session, "alpha")
        await _insert_nuvs_blast(session, "alpha", 5)
        await session.commit()

    await asyncio.to_thread(apply_alembic, REVISION)
    await asyncio.to_thread(_downgrade, DOWN_REVISION)

    async with AsyncSession(migration_pg) as session:
        file_analysis = (
            await session.execute(text("SELECT analysis FROM analysis_files"))
        ).scalar_one()
        blast_analysis_id = (
            await session.execute(text("SELECT analysis_id FROM nuvs_blast"))
        ).scalar_one()

    assert file_analysis == "alpha"
    assert blast_analysis_id == "alpha"
