from virtool.fake.wrapper import FakerWrapper
from virtool.otus.fake import create_fake_otus


async def test_create_fake_otus(dbi, snapshot, tmp_path):
    app = {"db": dbi, "data_path": tmp_path, "fake": FakerWrapper()}

    await create_fake_otus(app, "reference_1", "bob")

    assert await dbi.otus.find().to_list(None) == snapshot
    assert await dbi.sequences.find().to_list(None) == snapshot
