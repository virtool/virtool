async def test_create_fake_hmm(fake2, snapshot):
    hmm = await fake2.hmm.create(fake2.mongo)

    assert hmm == snapshot
