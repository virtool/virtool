async def test_delete_tokens(spawn_client):
    """
    Assert that id_token cookie is deleted from response at /oidc/delete_tokens endpoint
    """
    client = await spawn_client(use_b2c=True, base_url="")

    resp = await client.get("/oidc/delete_tokens")

    assert resp.cookies.get("id_token") is None
