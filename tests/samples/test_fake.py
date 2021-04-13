import pytest
from pprint import pprint
from virtool.samples.fake import create_fake_sample, create_fake_samples
from virtool.fake.wrapper import FakerWrapper
from virtool.samples.db import LIST_PROJECTION


@pytest.fixture
def app(dbi, pg, run_in_thread, tmpdir):
    return {
        "db": dbi,
        "fake": FakerWrapper(),
        "pg": pg,
        "run_in_thread": run_in_thread,
        "data_path": str(tmpdir),
    }


def clean_sample_document_for_snapshot(fake_sample):
    del fake_sample["created_at"]
    for f in fake_sample["files"]:
        del f["uploaded_at"]

    if "reads" in fake_sample:
        for f in fake_sample["reads"]:
            del f["uploaded_at"]

    return fake_sample


@pytest.mark.parametrize("paired", [True, False])
@pytest.mark.parametrize("finalized", [True, False])
async def test_create_fake_unpaired(paired, finalized, app, snapshot):
    fake_sample = await create_fake_sample(app, paired=paired, finalized=finalized)

    for key in LIST_PROJECTION:
        assert key in fake_sample

    if finalized is True:
        assert len(fake_sample["files"]) == (2 if paired else 1)
        assert fake_sample["ready"] is True

    snapshot.assert_match(clean_sample_document_for_snapshot(fake_sample))


async def test_create_fake_samples(app, snapshot):
    samples = await create_fake_samples(app)

    assert len(samples) == 3

    for sample in samples:
        snapshot.assert_match(clean_sample_document_for_snapshot(sample))
