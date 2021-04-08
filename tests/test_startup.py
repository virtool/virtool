import virtool.startup


async def test_init_faker(snapshot, spawn_client):
    client = await spawn_client(authorize=True)

    app = client.app

    await virtool.startup.init_faker(app)

    faker = app["faker"]

    assert faker
    snapshot.assert_match([faker.get_mongo_id() for _ in range(5)])
