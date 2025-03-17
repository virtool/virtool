from aiohttp import BasicAuth

from tests.fixtures.client import ClientSpawner, JobClientSpawner
from virtool.data.utils import get_data_from_app
from virtool.mongo.core import Mongo
from virtool.settings.oas import SettingsUpdateRequest
from virtool.utils import hash_key


class TestJobAuthentication:
    async def test_root_succeeds(self, spawn_job_client: JobClientSpawner):
        """Check that a request against the job accessible root URL (GET /) succeeds."""
        client = await spawn_job_client(authenticated=True)

        resp = await client.get("/")

        assert resp.status == 200

    async def test_unauthenticated_root_fails(self, spawn_job_client: JobClientSpawner):
        """Check that a request against the root API URL"""
        client = await spawn_job_client(authenticated=False)

        resp = await client.get("/")

        assert resp.status == 401

    async def test_protected_fails(
        self,
        mongo: Mongo,
        spawn_client: ClientSpawner,
    ):
        """Check that a request against GET /samples using job authentication fails.

        This path is not accessible to jobs.

        """
        key = "bar"

        client = await spawn_client(auth=BasicAuth("job-foo", key))

        await get_data_from_app(client.app).settings.update(
            SettingsUpdateRequest(minimum_password_length=8),
        )

        await mongo.jobs.insert_one({"_id": "foo", "key": hash_key(key)})

        resp = await client.get("/samples")

        assert resp.status == 401
