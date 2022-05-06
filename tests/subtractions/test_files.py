from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy import select

import virtool.subtractions.files
from virtool.subtractions.models import SubtractionFile


async def test_create_subtraction_files(snapshot, tmp_path, pg: AsyncEngine):
    test_dir = tmp_path / "subtractions" / "foo"
    test_dir.mkdir(parents=True)
    test_dir.joinpath("subtraction.fa.gz").write_text("FASTA file")
    test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")

    subtraction_files = ["subtraction.fa.gz", "subtraction.1.bt2"]

    await virtool.subtractions.files.create_subtraction_files(
        pg, "foo", subtraction_files, test_dir
    )

    rows = list()
    async with AsyncSession(pg) as session:
        assert (
            await session.execute(select(SubtractionFile))
        ).scalars().all() == snapshot
