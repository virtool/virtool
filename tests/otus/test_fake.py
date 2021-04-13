from virtool.fake.wrapper import FakerWrapper
from virtool.otus.fake import create_fake_otus


async def test_create_fake_otus(dbi, snapshot):
    app = {
        "db": dbi,
        "data_path": "/foo",
        "fake": FakerWrapper()
    }

    await create_fake_otus(
        app,
        "reference_1",
        "bob"
    )

    snapshot.assert_match(await dbi.otus.find().to_list(None), "otus")
    snapshot.assert_match(await dbi.sequences.find().to_list(None), "sequences")
