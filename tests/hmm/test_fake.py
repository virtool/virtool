from virtool.fake.next import DataFaker


async def test_create_fake_hmm(fake: DataFaker, snapshot):
    hmm = await fake.hmm.create(fake.mongo)

    assert hmm == snapshot
