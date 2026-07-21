import asyncio
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.utils import timestamp


async def _seed_sample(session: AsyncSession, legacy_id: str | None) -> int:
    result = await session.execute(
        text("""
            INSERT INTO legacy_samples (
                legacy_id, name, host, isolate, locale, notes, library_type,
                format, created_at, paired, ready, hold, is_legacy, all_read,
                all_write, group_read, group_write
            )
            VALUES (
                :legacy_id, 'Sample', '', '', '', '', 'normal',
                'fastq', :now, false, true, false, false, false,
                false, false, false
            )
            RETURNING id
        """),
        {"legacy_id": legacy_id, "now": timestamp()},
    )

    return result.scalar_one()


async def _seed_subtraction(session: AsyncSession, legacy_id: str | None) -> int:
    result = await session.execute(
        text("""
            INSERT INTO subtractions (legacy_id, name, nickname, created_at,
                                      deleted, ready)
            VALUES (:legacy_id, 'Subtraction', '', :now, false, true)
            RETURNING id
        """),
        {"legacy_id": legacy_id, "now": timestamp()},
    )

    return result.scalar_one()


async def test_upgrade(apply_alembic: Callable, migration_pg: AsyncEngine):
    """Backfilled ``storage_key`` reproduces each row's current storage prefix.

    A migrated row is keyed by its legacy Mongo slug; a natively created row (no
    ``legacy_id``) is keyed by its integer primary key. Recording exactly that value
    is what lets existing objects stay where they are.
    """
    await asyncio.to_thread(apply_alembic, "c976a55c3382")

    async with AsyncSession(migration_pg) as session:
        migrated_sample = await _seed_sample(session, "sample_legacy")
        native_sample = await _seed_sample(session, None)
        migrated_subtraction = await _seed_subtraction(session, "sub_legacy")
        native_subtraction = await _seed_subtraction(session, None)
        await session.commit()

    await asyncio.to_thread(apply_alembic, "5b86749d13eb")

    async with AsyncSession(migration_pg) as session:
        samples = (
            await session.execute(
                text("SELECT id, storage_key FROM legacy_samples ORDER BY id"),
            )
        ).all()

        subtractions = (
            await session.execute(
                text("SELECT id, storage_key FROM subtractions ORDER BY id"),
            )
        ).all()

    assert samples == [
        (migrated_sample, "sample_legacy"),
        (native_sample, str(native_sample)),
    ]
    assert subtractions == [
        (migrated_subtraction, "sub_legacy"),
        (native_subtraction, str(native_subtraction)),
    ]
