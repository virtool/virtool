from tests.fixtures.client import ClientSpawner

import os

import pytest

from virtool.config import get_config_from_app
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.fake.wrapper import FakerWrapper
from virtool.samples.fake import READ_FILES_PATH, copy_reads_file, create_fake_sample


@pytest.mark.parametrize("paired", [True, False])
@pytest.mark.parametrize("finalized", [True, False])
async def test_create_fake_sample(
    paired,
    finalized,
    data_layer: DataLayer,
    fake2: DataFaker,
    snapshot,
    spawn_client: ClientSpawner,
    static_time,
):
    client = await spawn_client(authenticated=True)

    user = await fake2.users.create()

    await create_fake_sample(
        client.app, "sample_1", user.id, finalized=finalized, paired=paired
    )

    sample = await data_layer.samples.get("sample_1")

    if finalized is True:
        assert len(sample.reads) == (2 if paired else 1)
        assert sample.ready is True

    assert sample == snapshot


async def test_copy_reads_file(app):
    file_path = READ_FILES_PATH / "paired_1.fq.gz"

    await copy_reads_file(app, file_path, "reads_1.fq.gz", "sample_1")

    assert os.listdir(get_config_from_app(app).data_path / "samples" / "sample_1") == [
        "reads_1.fq.gz"
    ]
