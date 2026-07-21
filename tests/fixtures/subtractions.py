from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.subtractions.pg import SQLSubtraction, SQLSubtractionFile


@pytest.fixture
async def test_subtraction_files(pg) -> int:
    """Insert a subtraction with three files and return its integer id."""
    async with AsyncSession(pg) as session:
        subtraction = SQLSubtraction(
            legacy_id="foo",
            storage_key="foo",
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
