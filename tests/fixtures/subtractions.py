from datetime import datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.subtractions.pg import SQLSubtraction, SQLSubtractionFile


async def resolve_subtraction_pk(pg: AsyncEngine, legacy_id: str) -> int:
    """Resolve a subtraction's integer id from its legacy string id.

    ``samples.subtractions`` holds integer ids, so linked-sample fixtures must
    reference the subtraction by its ``subtractions.id`` rather than its legacy id.

    Interim: delete once the subtraction public id is an integer (VIR-2535).
    """
    async with AsyncSession(pg) as session:
        return (
            await session.execute(
                select(SQLSubtraction.id).where(SQLSubtraction.legacy_id == legacy_id),
            )
        ).scalar_one()


@pytest.fixture
async def test_subtraction_files(pg) -> int:
    """Insert a subtraction with three files and return its integer id."""
    async with AsyncSession(pg) as session:
        subtraction = SQLSubtraction(
            legacy_id="foo",
            name="Foo",
            created_at=datetime(2015, 10, 6, 20, 0, 0),
            ready=True,
        )
        session.add(subtraction)
        await session.flush()

        session.add_all(
            [
                SQLSubtractionFile(
                    id=1,
                    name="subtraction.fq.gz",
                    subtraction_id=subtraction.id,
                    type="fasta",
                    size=12345,
                ),
                SQLSubtractionFile(
                    id=2,
                    name="subtraction.1.bt2",
                    subtraction_id=subtraction.id,
                    type="bowtie2",
                    size=56437,
                ),
                SQLSubtractionFile(
                    id=3,
                    name="subtraction.2.bt2",
                    subtraction_id=subtraction.id,
                    type="bowtie2",
                    size=93845,
                ),
            ]
        )

        subtraction_id = subtraction.id

        await session.commit()

    return subtraction_id


@pytest.fixture
def insert_subtractions(pg):
    """Insert Postgres subtractions and return a ``{legacy_id: id}`` map.

    Pass ``(legacy_id, name)`` pairs. Subtractions are addressed by their integer
    ``id`` now that ``samples.subtractions`` holds integers, so the returned map
    lets callers look up the auto-generated id for each seeded subtraction.

    ``created_at`` is a fixed naive-UTC literal rather than ``static_time`` because
    that fixture patches the global clock, which would leak into consumers that
    create entities through the data layer. The value is never surfaced.
    """

    # Interim: returns the legacy_id -> integer id map only so callers can address
    # subtractions by integer while the subtraction public id is still a string.
    # Revert to returning None after the subtraction id cutover (VIR-2535).
    async def func(*subtractions: tuple[str, str]) -> dict[str, int]:
        async with AsyncSession(pg) as session:
            rows = [
                SQLSubtraction(
                    legacy_id=legacy_id,
                    name=name,
                    created_at=datetime(2015, 10, 6, 20, 0, 0),
                    ready=True,
                )
                for legacy_id, name in subtractions
            ]

            session.add_all(rows)
            await session.flush()

            id_map = {row.legacy_id: row.id for row in rows}

            await session.commit()

        return id_map

    return func
