import os

import pytest

from virtool.samples.fake import create_fake_sample, create_fake_samples, copy_reads_file, READ_FILES_PATH
from virtool.fake.wrapper import FakerWrapper
from virtool.samples.db import LIST_PROJECTION


@pytest.fixture
def app(dbi, pg, run_in_thread, tmp_path):
    return {
        "db": dbi,
        "fake": FakerWrapper(),
        "pg": pg,
        "run_in_thread": run_in_thread,
        "settings": {
            "data_path": tmp_path
        },
    }


@pytest.mark.parametrize("paired", [True, False])
@pytest.mark.parametrize("finalized", [True, False])
async def test_create_fake_unpaired(paired, finalized, app, snapshot,
                                    static_time):
    fake_sample = await create_fake_sample(app,
                                           "sample_1",
                                           "bob",
                                           paired=paired,
                                           finalized=finalized)

    for key in LIST_PROJECTION:
        assert key in fake_sample

    if finalized is True:
        assert len(fake_sample["reads"]) == (2 if paired else 1)
        assert fake_sample["ready"] is True

    snapshot.assert_match(fake_sample)


async def test_create_fake_samples(app, snapshot, dbi, static_time):
    samples = await create_fake_samples(app)

    assert len(samples) == 3

    for sample in samples:
        snapshot.assert_match(sample)

    assert os.listdir(app["settings"]["data_path"] / "samples" / "LB1U6zCj") == ["reads_1.fq.gz"]
    assert set(os.listdir(app["settings"]["data_path"] / "samples" / "2x6YnyMt")) == {"reads_1.fq.gz", "reads_2.fq.gz"}


async def test_copy_reads_file(app):
    file_path = READ_FILES_PATH / "paired_1.fq.gz"

    await copy_reads_file(app, file_path, "reads_1.fq.gz", "sample_1")

    assert os.listdir(app["settings"]["data_path"] / "samples" / "sample_1") == ["reads_1.fq.gz"]
