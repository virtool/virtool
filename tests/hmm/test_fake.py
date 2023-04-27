async def test_create_fake_hmm(fake2, spawn_client, snapshot):
    client = await spawn_client(authorize=True)

    hmm = await fake2.hmm.create(fake2.mongo)

    assert hmm == snapshot
