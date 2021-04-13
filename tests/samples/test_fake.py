import pytest
from pprint import pprint
from virtool.samples.fake import create_fake_sample
from virtool.fake.wrapper import FakerWrapper
from virtool.samples.db import LIST_PROJECTION


@pytest.mark.parametrize("paired", [True, False])
async def test_create_fake_unpaired(paired, dbi, pg):
    app = {"db": dbi, "fake": FakerWrapper(), "pg": pg}

    fake_sample = await create_fake_sample(app, paired)

    for key in LIST_PROJECTION:
        assert key in fake_sample

    assert len(fake_sample["files"]) == (2 if paired else 1)
