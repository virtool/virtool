import os

from virtool.dev.fake import USER_ID
from virtool.pg.utils import get_row
from virtool.subtractions.fake import create_fake_subtractions
from virtool.subtractions.models import SubtractionFile
from virtool.subtractions.utils import FILES


async def test_create_fake_subtractions(app, example_path, snapshot, static_time, tmpdir):
    example_path = example_path / "subtractions/arabidopsis_thaliana"
    subtractions_path = tmpdir.mkdir("subtractions").mkdir("subtraction_1")

    await create_fake_subtractions(app, USER_ID)

    assert len(os.listdir(subtractions_path)) == 7

    snapshot.assert_match(await app["db"].subtraction.find().to_list(None))

    for file_ in FILES:
        assert await get_row(app["pg"], file_, SubtractionFile, "name")

        with open(subtractions_path / file_, "r") as f_result:
            with open(example_path / file_, "r") as f_expected:
                assert f_result.read() == f_expected.read()
