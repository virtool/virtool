async def test_create(spawn_client, test_random_alphanumeric, static_time):
    client = await spawn_client(authorize=True, permissions=["create_ref"])

    default_source_type = [
        "strain",
        "isolate"
    ]

    client.app["settings"] = {
        "default_source_types": default_source_type
    }

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
        created_at="2015-10-06T20:00:00Z",
        user={
            "id": "test"
        },
        users=[{
            "build": True,
            "id": "test",
            "modify": True,
            "modify_otu": True,
            "remove": True
        }],
        contributors=[],
        internal_control=None,
        restrict_source_types=False,
        source_types=default_source_type,
        latest_build=None
    )
