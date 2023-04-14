import pytest


@pytest.mark.apitest
async def test_delete_tokens(spawn_client):
    """
    Assert that id_token cookie is deleted from response at /oidc/delete_tokens endpoint
    """
    client = await spawn_client(
        base_url="",
        config_overrides={
            "b2c_tenant": "vt-test",
            "b2c_client_id": "virtool",
            "b2c_client_secret": "abc123def456ghi789",
            "b2c_user_flow": "B2C_1_signup_signin",
            "use_b2c": True,
        },
    )

    resp = await client.get("/oidc/delete_tokens")

    assert resp.cookies.get("id_token") is None
