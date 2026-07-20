"""Tests for the drop-legacy_history-index_version migration.

The upgrade drops the redundant ``index_version`` column after a tripwire confirms
every stored value still agrees with the authoritative ``indexes.version``. The
downgrade re-adds the column and rebuilds it from the same join, leaving unbuilt
rows ``NULL``.
"""

import asyncio
from datetime import datetime
from pathlib import Path

import alembic.command
import alembic.config
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.utils import timestamp

_BEFORE_DROP = "241675dea96f"
_DROP = "c976a55c3382"
_CREATED_AT = datetime(2026, 7, 1, 12, 0, 0)


def _downgrade(revision: str) -> None:
    """Downgrade to ``revision`` using the SQLALCHEMY_URL set by ``apply_alembic``."""
    alembic.command.downgrade(
        alembic.config.Config(Path(__file__).parent.parent.parent / "alembic.ini"),
        revision,
    )


async def _seed_reference_and_index(
    pg: AsyncEngine,
    *,
    index_version: int,
) -> dict[str, int]:
    """Seed a user, reference and one built index carrying ``index_version``.

    Returns the ids needed to seed ``legacy_history`` rows.
    """
    async with AsyncSession(pg) as session:
        user_id = (
            await session.execute(
                text("""
                    INSERT INTO users (
                        handle, legacy_id, active, email, force_reset,
                        invalidate_sessions, last_password_change, password, settings
                    )
                    VALUES (
                        'history_owner', 'history_owner_legacy', true, '',
                        false, false, :now, :pw, '{}'::jsonb
                    )
                    RETURNING id
                """),
                {"now": timestamp(), "pw": b"hashed"},
            )
        ).scalar_one()

        reference_id = (
            await session.execute(
                text("""
                    INSERT INTO legacy_references (
                        legacy_id, name, description, organism, created_at,
                        archived, restrict_source_types, source_types, user_id
                    )
                    VALUES (
                        'ref_legacy', 'Plant Viruses', '', '', :now,
                        false, false, '[]'::jsonb, :user_id
                    )
                    RETURNING id
                """),
                {"now": timestamp(), "user_id": user_id},
            )
        ).scalar_one()

        index_id = (
            await session.execute(
                text("""
                    INSERT INTO indexes (
                        legacy_id, version, created_at, manifest, ready,
                        storage_key, reference_id, user_id
                    )
                    VALUES (
                        'idx_legacy', :version, :now, '{}'::jsonb, true,
                        'idx_legacy', :reference_id, :user_id
                    )
                    RETURNING id
                """),
                {
                    "version": index_version,
                    "now": _CREATED_AT,
                    "reference_id": reference_id,
                    "user_id": user_id,
                },
            )
        ).scalar_one()

        await session.commit()

    return {"user_id": user_id, "reference_id": reference_id, "index_id": index_id}


async def _seed_history(
    pg: AsyncEngine,
    seeded: dict[str, int],
    *,
    legacy_id: str,
    index: str | None,
    index_id: int | None,
    index_version: str | None,
) -> None:
    """Insert one ``legacy_history`` row, setting the pre-drop ``index_version``."""
    async with AsyncSession(pg) as session:
        await session.execute(
            text("""
                INSERT INTO legacy_history (
                    legacy_id, created_at, description, method_name, user_id,
                    otu, otu_name, otu_version, reference_id,
                    index, index_id, index_version
                )
                VALUES (
                    :legacy_id, :now, '', 'create', :user_id,
                    :otu, :otu, '0', :reference_id,
                    :index, :index_id, :index_version
                )
            """),
            {
                "legacy_id": legacy_id,
                "now": _CREATED_AT,
                "user_id": seeded["user_id"],
                "otu": legacy_id.split(".", maxsplit=1)[0],
                "reference_id": seeded["reference_id"],
                "index": index,
                "index_id": index_id,
                "index_version": index_version,
            },
        )
        await session.commit()


async def _column_exists(pg: AsyncEngine, column_name: str) -> bool:
    async with AsyncSession(pg) as session:
        return bool(
            await session.scalar(
                text("""
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_name = 'legacy_history' AND column_name = :column
                """),
                {"column": column_name},
            ),
        )


async def test_upgrade_drops_column(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    """A consistent built row and an unbuilt row survive the drop."""
    await asyncio.to_thread(apply_alembic, _BEFORE_DROP)
    await migration_pg.dispose()

    seeded = await _seed_reference_and_index(migration_pg, index_version=5)
    await _seed_history(
        migration_pg,
        seeded,
        legacy_id="otu_a.1",
        index="idx_legacy",
        index_id=seeded["index_id"],
        index_version="5",
    )
    await _seed_history(
        migration_pg,
        seeded,
        legacy_id="otu_a.0",
        index=None,
        index_id=None,
        index_version=None,
    )
    await migration_pg.dispose()

    assert await _column_exists(migration_pg, "index_version")
    await migration_pg.dispose()

    await asyncio.to_thread(apply_alembic, _DROP)
    await migration_pg.dispose()

    assert not await _column_exists(migration_pg, "index_version")

    async with AsyncSession(migration_pg) as session:
        rows = {
            row.legacy_id: row.index_id
            for row in (
                await session.execute(
                    text("SELECT legacy_id, index_id FROM legacy_history"),
                )
            )
        }

    assert rows == {"otu_a.1": seeded["index_id"], "otu_a.0": None}


async def test_downgrade_repopulates_from_join(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    """Downgrade rebuilds ``index_version`` from ``indexes.version``, unbuilt stays NULL."""
    await asyncio.to_thread(apply_alembic, _BEFORE_DROP)
    await migration_pg.dispose()

    seeded = await _seed_reference_and_index(migration_pg, index_version=5)
    await _seed_history(
        migration_pg,
        seeded,
        legacy_id="otu_a.1",
        index="idx_legacy",
        index_id=seeded["index_id"],
        index_version="5",
    )
    await _seed_history(
        migration_pg,
        seeded,
        legacy_id="otu_a.0",
        index=None,
        index_id=None,
        index_version=None,
    )
    await migration_pg.dispose()

    await asyncio.to_thread(apply_alembic, _DROP)
    await migration_pg.dispose()

    await asyncio.to_thread(_downgrade, _BEFORE_DROP)
    await migration_pg.dispose()

    async with AsyncSession(migration_pg) as session:
        rows = {
            row.legacy_id: row.index_version
            for row in (
                await session.execute(
                    text("SELECT legacy_id, index_version FROM legacy_history"),
                )
            )
        }

    assert rows == {"otu_a.1": "5", "otu_a.0": None}


async def test_tripwire_version_mismatch_raises(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    """A built row whose stored version disagrees with ``indexes.version`` aborts."""
    await asyncio.to_thread(apply_alembic, _BEFORE_DROP)
    await migration_pg.dispose()

    seeded = await _seed_reference_and_index(migration_pg, index_version=5)
    await _seed_history(
        migration_pg,
        seeded,
        legacy_id="otu_a.0",
        index="idx_legacy",
        index_id=seeded["index_id"],
        index_version="4",
    )
    await migration_pg.dispose()

    with pytest.raises(RuntimeError, match="disagrees with indexes.version"):
        await asyncio.to_thread(apply_alembic, _DROP)


async def test_tripwire_missing_version_raises(
    apply_alembic: callable,
    migration_pg: AsyncEngine,
):
    """A built row (``index_id`` set) with a ``NULL`` ``index_version`` aborts."""
    await asyncio.to_thread(apply_alembic, _BEFORE_DROP)
    await migration_pg.dispose()

    seeded = await _seed_reference_and_index(migration_pg, index_version=5)
    await _seed_history(
        migration_pg,
        seeded,
        legacy_id="otu_a.0",
        index="idx_legacy",
        index_id=seeded["index_id"],
        index_version=None,
    )
    await migration_pg.dispose()

    with pytest.raises(RuntimeError, match="disagrees with indexes.version"):
        await asyncio.to_thread(apply_alembic, _DROP)
