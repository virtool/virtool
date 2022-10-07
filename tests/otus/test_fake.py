from virtool.fake.wrapper import FakerWrapper
from virtool.otus.fake import create_fake_otus


async def test_create_fake_otus(mongo, fake2, snapshot, tmp_path):
    app = {"db": mongo, "data_path": tmp_path, "fake": FakerWrapper()}

    user = await fake2.users.create()

    await create_fake_otus(app, "reference_1", user.id)

    assert await mongo.otus.find().to_list(None) == snapshot
    assert await mongo.sequences.find().to_list(None) == snapshot
