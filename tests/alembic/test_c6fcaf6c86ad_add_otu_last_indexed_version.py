import asyncio
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.utils import timestamp


async def _seed_otu(session: AsyncSession, otu_id: str, reference_id: int, data: str):
    await session.execute(
        text("""
            INSERT INTO legacy_otus (
                id, data, name, abbreviation, reference_id, verified, version
            )
            VALUES (:id, :data ::jsonb, 'Tobacco mosaic virus', 'TMV', :reference_id,
                    true, 3)
        """),
        {"id": otu_id, "data": data, "reference_id": reference_id},
    )


async def test_upgrade(apply_alembic: Callable, migration_pg: AsyncEngine):
    """Rows written before the column existed come out of it holding what they hold.

    ``last_indexed_version`` lived only in the ``data`` JSONB until this revision, so
    the column has to be filled from it. A stamped OTU carries a number; an OTU no
    index build has ever included carries a JSON ``null`` and must come out ``NULL``
    rather than losing the distinction.
    """
    await asyncio.to_thread(apply_alembic, "f8aa696aa0d3")

    async with AsyncSession(migration_pg) as session:
        user_id = (
            await session.execute(
                text("""
                    INSERT INTO users (
                        handle, legacy_id, active, email, force_reset,
                        invalidate_sessions, last_password_change, password, settings
                    )
                    VALUES (
                        'reference_owner', 'reference_owner_legacy', true, '',
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

        await _seed_otu(
            session,
            "otu_indexed",
            reference_id,
            '{"last_indexed_version": 2}',
        )

        await _seed_otu(
            session,
            "otu_never_indexed",
            reference_id,
            '{"last_indexed_version": null}',
        )

        await session.commit()

    await asyncio.to_thread(apply_alembic, "c6fcaf6c86ad")

    async with AsyncSession(migration_pg) as session:
        rows = (
            await session.execute(
                text(
                    "SELECT id, last_indexed_version FROM legacy_otus ORDER BY id",
                ),
            )
        ).all()

    assert rows == [("otu_indexed", 2), ("otu_never_indexed", None)]
