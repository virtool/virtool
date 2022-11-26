import asyncio

from virtool.fake.wrapper import FakerWrapper
from virtool.otus.fake import create_fake_otus


async def test_create_fake_otus(mongo, config, fake2, snapshot, tmp_path):
    app = {"db": mongo, "data_path": tmp_path, "fake": FakerWrapper(), "config": config}

    user = await fake2.users.create()

    await mongo.references.insert_one(
        {"_id": "reference_1", "name": "Reference 1", "data_type": "genome"}
    )

    await create_fake_otus(app, "reference_1", user.id)

    otus, sequences = await asyncio.gather(
        mongo.otus.find().to_list(None), mongo.sequences.find().to_list(None)
    )

    assert otus == snapshot
    assert sequences == snapshot
