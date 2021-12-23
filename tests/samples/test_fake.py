import os

import pytest
from virtool.fake.wrapper import FakerWrapper
from virtool.samples.db import LIST_PROJECTION
from virtool.samples.fake import READ_FILES_PATH, copy_reads_file, create_fake_sample


@pytest.fixture
def app(dbi, pg, run_in_thread, tmp_path, config):
    return {
        "db": dbi,
        "fake": FakerWrapper(),
        "pg": pg,
        "run_in_thread": run_in_thread,
        "config": config,
    }


@pytest.mark.parametrize("paired", [True, False])
@pytest.mark.parametrize("finalized", [True, False])
async def test_create_fake_unpaired(
    paired, finalized, app, fake, snapshot, static_time
):
    user = await fake.users.insert()

    fake_sample = await create_fake_sample(
        app, "sample_1", user["_id"], paired=paired, finalized=finalized
    )

    assert set(LIST_PROJECTION) <= set(fake_sample.keys())

    if finalized is True:
        assert len(fake_sample["reads"]) == (2 if paired else 1)
        assert fake_sample["ready"] is True

    assert fake_sample == snapshot


async def test_copy_reads_file(app):
    file_path = READ_FILES_PATH / "paired_1.fq.gz"

    await copy_reads_file(app, file_path, "reads_1.fq.gz", "sample_1")

    assert os.listdir(app["config"].data_path / "samples" / "sample_1") == [
        "reads_1.fq.gz"
    ]
