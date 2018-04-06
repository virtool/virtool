import pytest


parameters = [
    # Files
    ("delete", ("/api/files/foobar",)),

    # Groups
    ("get", ("/api/groups",)),
    ("post", ("/api/groups", {})),
    ("get", ("/api/groups/foobar",)),
    ("patch", ("/api/groups/foobar", {})),
    ("delete", ("/api/groups/foobar",)),

    # History
    ("delete", ("/api/history/foobar",)),

    # HMMs
    ("patch", ("/api/hmms/install", {})),

    # Indexes
    ("post", ("/api/indexes", {})),

    # Jobs
    ("post", ("/api/jobs/foobar/cancel", {})),
    ("delete", ("/api/jobs/foobar",)),
    ("delete", ("/api/jobs",)),

    # Settings
    ("patch", ("/api/settings", {})),

    # Subtraction
    ("post", ("/api/subtraction", {})),
    ("delete", ("/api/subtraction/foobar",)),

    # Updates
    ("post", ("/api/updates/software", {})),

    # Users
    ("get", ("/api/users",)),
    ("get", ("/api/users/foobar",)),
    ("post", ("/api/users", {})),
    ("patch", ("/api/users/foobar", {})),
    ("post", ("/api/users/foobar/groups", {})),
    ("delete", ("/api/users/foobar/groups/baz",)),
    ("delete", ("/api/users/foobar",)),

    # Viruses
    ("post", ("/api/viruses", {})),
    ("patch", ("/api/viruses/foobar", {})),
    ("delete", ("/api/viruses/foobar",)),
    ("post", ("/api/viruses/foobar/isolates", {})),
    ("patch", ("/api/viruses/foobar/isolates/test", {})),
    ("delete", ("/api/viruses/foobar/isolates/test",)),
    ("post", ("/api/viruses/foobar/isolates/test/sequences", {})),
    ("patch", ("/api/viruses/foobar/isolates/test/sequences/foobar", {})),

]

authorized_only = [
    ("get", ("/api/account/settings",)),
    ("patch", ("/api/account/settings", {})),
    ("put", ("/api/account/password", {})),
]


@pytest.mark.parametrize("method, args", parameters + authorized_only)
async def test_not_authorized(method, args, spawn_client):
    client = await spawn_client()

    doer = getattr(client, method)

    resp = await doer(*args)

    assert resp.status == 401

    assert await resp.json() == {
        "id": "requires_authorization",
        "message": "Requires authorization"
    }


@pytest.mark.parametrize("method, args", parameters)
async def test_not_permitted(method, args, spawn_client):
    client = await spawn_client(authorize=True)

    doer = getattr(client, method)

    resp = await doer(*args)

    assert resp.status == 403

    assert await resp.json() == {
        "id": "not_permitted",
        "message": "Not permitted"
    }
