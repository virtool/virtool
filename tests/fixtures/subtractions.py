from datetime import datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.subtractions.pg import SQLSubtraction, SQLSubtractionFile


@pytest.fixture
async def test_subtraction_files(pg) -> int:
    """Insert a subtraction with one file and return its integer id."""
    async with AsyncSession(pg) as session:
        subtraction = SQLSubtraction(
            legacy_id="foo",
            name="Foo",
            created_at=datetime(2015, 10, 6, 20, 0, 0),
            ready=True,
        )
        session.add(subtraction)
        await session.flush()

        session.add(
            SQLSubtractionFile(
                id=1,
                name="subtraction.fa.gz",
                subtraction_id=subtraction.id,
                type="fasta",
                size=12345,
            )
        )

        subtraction_id = subtraction.id

        await session.commit()

    return subtraction_id
