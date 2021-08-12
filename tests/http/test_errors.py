import pytest


@pytest.mark.parametrize("is_api_call, path", [(True, "/api/foo"), (False, "/foo/bar")])
async def test_is_api_call(is_api_call, path, spawn_client):
    """
    404 errors should be handled differently depending on whether the request is an API call or not.

    If the request is an API call, a json body should be returned by the virtool.http.errors middleware.

    If not, handle_404() will be called and an html template will be used to render the 404 error message.
    """
    client = await spawn_client(authorize=True)

    resp = await client.get(path)
    assert resp.status == 404

    if is_api_call:
        assert resp.content_type == "application/json"
    else:
        assert resp.content_type == "text/html"
