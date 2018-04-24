async def test_create(spawn_client, test_random_alphanumeric, static_time):
    client = await spawn_client(authorize=True, permissions=["create_ref"])

    data = {
        "name": "Test Viruses",
        "description": "A bunch of viruses used for testing",
        "data_type": "genome",
        "organism": "virus",
        "public": True
    }

    resp = await client.post("/api/refs", data)

    assert resp.status == 201

    assert resp.headers["Location"] == "/api/refs/" + test_random_alphanumeric.history[0]

    assert await resp.json() == dict(
        data,
        id=test_random_alphanumeric.history[0],
        created_at=static_time.iso,
        user={
            "id": "test"
        },
        users=[{
            "build": True,
            "id": "test",
            "modify": True,
            "modify_kind": True,
            "remove": True
        }]
    )
