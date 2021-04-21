from sqlalchemy import select

import virtool.subtractions.files

from virtool.subtractions.models import SubtractionFile


async def test_create_subtraction_files(tmp_path, pg, pg_session):
    test_dir = tmp_path / "subtractions" / "foo"
    test_dir.mkdir(parents=True)
    test_dir.joinpath("subtraction.fa.gz").write_text("FASTA file")
    test_dir.joinpath("subtraction.1.bt2").write_text("Bowtie2 file")

    subtraction_files = ["subtraction.fa.gz", "subtraction.1.bt2"]

    await virtool.subtractions.files.create_subtraction_files(pg, "foo", subtraction_files, test_dir)

    rows = list()
    async with pg_session as session:
        files = (await session.execute(select(SubtractionFile))).scalars().all()
        for file in files:
            rows.append(file.to_dict())

    assert rows == [
        {
            'id': 1,
            'name': 'subtraction.fa.gz',
            'subtraction': 'foo',
            'type': 'fasta',
            'size': 10
        },
        {
            'id': 2,
            'name': 'subtraction.1.bt2',
            'subtraction': 'foo',
            'type': 'bowtie2',
            'size': 12
        }
    ]
