async def test_delete_tokens(spawn_client):
    """
    Assert that id_token cookie is deleted from response at /oidc/delete_tokens endpoint
    """
    client = await spawn_client(base_url="", use_b2c=True)

    resp = await client.get("/oidc/delete_tokens")

    assert resp.cookies.get("id_token") is None
