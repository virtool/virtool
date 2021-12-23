import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.subtractions.models import SubtractionFile


@pytest.fixture
async def test_subtraction_files(pg):
    file_1 = SubtractionFile(
        id=1, name="subtraction.fq.gz", subtraction="foo", type="fasta", size=12345
    )
    file_2 = SubtractionFile(
        id=2, name="subtraction.1.bt2", subtraction="foo", type="bowtie2", size=56437
    )
    file_3 = SubtractionFile(
        id=3, name="subtraction.2.bt2", subtraction="foo", type="bowtie2", size=93845
    )

    async with AsyncSession(pg) as session:
        session.add_all([file_1, file_2, file_3])

        await session.commit()
