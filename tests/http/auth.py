from aiohttp import BasicAuth

from virtool.utils import hash_key


async def test_receives_session_id(mocker, spawn_client):
    mocker.patch("secrets.token_hex", return_value="foobar")

    client = await spawn_client()

    resp = await client.get("/api")

    assert resp.status == 401
    assert client.has_cookie("session_id", "foobar")


class TestJobAuthentication:

    async def test_root_succeeds(self, dbi, spawn_client):
        """
        Check that a request against the job accessible root URL (GET /api) succeeds.

        """
        key = "bar"

        client = await spawn_client(auth=BasicAuth("job-foo", key))
        client.settings["enable_api"] = True

        await dbi.jobs.insert_one({
            "_id": "foo",
            "key": hash_key(key)
        })

        resp = await client.get("/api")

        assert resp.status == 200

    async def test_unauthenticated_root_fails(self, dbi, spawn_client):
        """
        Check that an request against the root API URL

        """
        key = "bar"

        client = await spawn_client(auth=BasicAuth("job-foo", "no_good"))
        client.settings["enable_api"] = True

        await dbi.jobs.insert_one({
            "_id": "foo",
            "key": hash_key(key)
        })

        resp = await client.get("/api")

        assert resp.status == 401

    async def test_protected_fails(self, dbi, spawn_client):
        """
        Check that a request against GET /api/samples using job authentication fails. This URI is
        not accessible to jobs.

        """
        key = "bar"

        client = await spawn_client(auth=BasicAuth("job-foo", key))
        client.settings["enable_api"] = True

        await dbi.jobs.insert_one({
            "_id": "foo",
            "key": hash_key(key)
        })

        resp = await client.get("/api/samples")

        assert resp.status == 403
