import filecmp
import gzip
import os
from pathlib import Path

from virtool.pg.utils import get_row
from virtool.subtractions.fake import create_fake_subtractions
from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.utils import FILES


async def test_create_fake_subtractions(app, example_path, snapshot, static_time, tmp_path):
    example_path = example_path / "subtractions/arabidopsis_thaliana"
    subtractions_path = tmp_path / "subtractions" / "2x6YnyMt"
    subtractions_path.mkdir(parents=True)

    await create_fake_subtractions(app)

    assert len(os.listdir(subtraction_path)) == 7

    snapshot.assert_match(await app["db"].subtraction.find().to_list(None))

    for file_name in FILES:
        assert await get_row(app["pg"], file_name, SubtractionFile, "name")

        is_fasta = "fa.gz" in file_name

        if is_fasta:
            with gzip.open(subtraction_path / file_name, "rt") as f_result:
                with gzip.open(example_path / file_name, "rt") as f_expected:
                    assert f_result.read() == f_expected.read()

        else:
            assert filecmp.cmp(
                example_path / file_name,
                subtraction_path / file_name,
                shallow=False
            )
