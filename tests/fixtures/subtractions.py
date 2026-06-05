from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.subtractions.pg import SQLSubtraction, SQLSubtractionFile


@pytest.fixture
async def test_subtraction_files(pg):
    file_1 = SQLSubtractionFile(
        id=1, name="subtraction.fq.gz", subtraction="foo", type="fasta", size=12345
    )
    file_2 = SQLSubtractionFile(
        id=2, name="subtraction.1.bt2", subtraction="foo", type="bowtie2", size=56437
    )
    file_3 = SQLSubtractionFile(
        id=3, name="subtraction.2.bt2", subtraction="foo", type="bowtie2", size=93845
    )

    async with AsyncSession(pg) as session:
        session.add_all([file_1, file_2, file_3])

        await session.commit()


@pytest.fixture
def insert_subtractions(pg):
    """Insert Postgres subtractions keyed by legacy id.

    Pass ``(legacy_id, name)`` pairs. The created subtractions resolve through the
    ``legacy_id`` column the way string-keyed referrers reference them.

    ``created_at`` is a fixed naive-UTC literal rather than ``static_time`` because
    that fixture patches the global clock, which would leak into consumers that
    create entities through the data layer. The value is never surfaced.
    """

    async def func(*subtractions: tuple[str, str]) -> None:
        async with AsyncSession(pg) as session:
            session.add_all(
                SQLSubtraction(
                    legacy_id=legacy_id,
                    name=name,
                    created_at=datetime(2015, 10, 6, 20, 0, 0),
                    ready=True,
                )
                for legacy_id, name in subtractions
            )

            await session.commit()

    return func
