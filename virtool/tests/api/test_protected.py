import pytest


parameters = [
    ("post", ("/api/viruses", {})),
    ("patch", ("/api/viruses/foobar", {})),
    ("delete", ("/api/viruses/foobar",)),
    ("post", ("/api/viruses/foobar/isolates", {})),
    ("patch", ("/api/viruses/foobar/isolates/test", {})),
    ("delete", ("/api/viruses/foobar/isolates/test",)),

    ("patch", ("/api/hmm/annotations/foobar", {})),

    ("get", ("/api/groups",)),
    ("post", ("/api/groups", {})),
    ("get", ("/api/groups/foobar",)),
    ("patch", ("/api/groups/foobar", {})),
    ("delete", ("/api/groups/foobar",))
]

authorized_only = [
    ("get", ("/api/account/settings",)),
    ("patch", ("/api/account/settings", {})),
    ("put", ("/api/account/password", {})),
]


@pytest.mark.parametrize("method, args", parameters + authorized_only)
async def test_not_authorized(method, args, do_get, do_post, do_patch, do_put, do_delete):
    doer = {
        "get": do_get,
        "post": do_post,
        "patch": do_patch,
        "put": do_put,
        "delete": do_delete
    }[method]

    resp = await doer(*args)

    assert resp.status == 403

    assert await resp.json() == {
        "message": "Not authorized"
    }


@pytest.mark.parametrize("method, args", parameters)
async def test_not_permitted(method, args, do_get, do_post, do_patch, do_put, do_delete):
    doer = {
        "get": do_get,
        "post": do_post,
        "patch": do_patch,
        "put": do_put,
        "delete": do_delete
    }[method]

    resp = await doer(*args, authorize=True)

    assert resp.status == 403

    assert await resp.json() == {
        "message": "Not permitted"
    }
