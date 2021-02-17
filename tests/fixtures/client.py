import base64
import json

import pytest

import virtool.app
import virtool.users.utils
from virtool.utils import hash_key


class VirtoolTestClient:

    def __init__(self, test_client):
        self._test_client = test_client

        self.server = self._test_client.server
        self.app = self.server.app
        self.settings = self.app["settings"]
        self.db = self.app["db"]

        self.auth = self._test_client.session.auth
        self.cookie_jar = self._test_client.session.cookie_jar

    def get_cookie(self, key):
        for cookie in self._test_client.session.cookie_jar:
            if cookie.key == key:
                return cookie.value

        return None

    def has_cookie(self, key, value):
        return self.get_cookie(key) == value

    async def get(self, url, params=None):
        return await self._test_client.get(url, params=params)

    async def post(self, url, data=None):
        payload = None

        if data:
            payload = json.dumps(data)

        return await self._test_client.post(url, data=payload)

    async def post_form(self, url, data):
        return await self._test_client.post(url, data=data)

    async def patch(self, url, data):
        return await self._test_client.patch(url, data=json.dumps(data))

    async def put(self, url, data):
        return await self._test_client.put(url, data=json.dumps(data))

    async def delete(self, url):
        return await self._test_client.delete(url)


@pytest.fixture
def create_app(
        create_user,
        dbi,
        pg_connection_string,
        redis_connection_string,
        test_db_connection_string,
        test_db_name,
):
    def _create_app(
            dev=False,
    ):
        return virtool.app.create_app({
            "dev": dev,
            "db_connection_string": test_db_connection_string,
            "redis_connection_string": redis_connection_string,
            "postgres_connection_string": pg_connection_string,
            "db_name": test_db_name,
            "force_version": "v0.0.0",
            "no_client": True,
            "no_check_db": True,
            "no_check_files": True,
            "no_fetching": True,
            "no_job_interface": False,
            "no_sentry": True
        })

    return _create_app


@pytest.fixture
def spawn_client(
        pg_engine,
        request,
        aiohttp_client,
        test_motor,
        dbi,
        pg_session,
        create_app,
        create_user
):
    async def func(
            auth=None,
            authorize=False,
            administrator=False,
            dev=False,
            enable_api=False,
            groups=None,
            permissions=None
    ):
        app = create_app(dev)

        user_document = create_user("test", administrator, groups, permissions)
        await dbi.users.insert_one(user_document)

        if authorize:
            session_token = "bar"

            await dbi.sessions.insert_one({
                "_id": "foobar",
                "ip": "127.0.0.1",
                "administrator": administrator,
                "force_reset": False,
                "groups": user_document["groups"],
                "permissions": user_document["permissions"],
                "token": hash_key(session_token),
                "user_agent": "Python/3.6 aiohttp/3.4.4",
                "user": {
                    "id": "test"
                }
            })

            cookies = {
                "session_id": "foobar",
                "session_token": "bar"
            }
        else:
            cookies = {
                "session_id": "dne"
            }

        test_client = await aiohttp_client(app, auth=auth, cookies=cookies)

        return VirtoolTestClient(test_client)

    return func


def job_authenticated(method, job_id, key):
    """
    Wraps the :func:`get`, :func:`post`, :func:`patch`, :func:`delete` methods of :class:`aiohttp.ClientSession`

    Before calling the request method, an authentication header is added which will authenticate the request as if
    it were being sent by a Virtool Job.

    A document is also added to the database to authenticate against, using the `job_id` and `key` given.

    :param: The ID of the test job which will be created.
    :param: The key that will be used to authenticate that test job.
    """

    async def _job_authenticated(*args, headers=None, **kwargs):
        if not headers:
            headers = {}

        auth_header = f"job-{job_id}:{key}".encode("utf-8")
        base64header = base64.b64encode(auth_header).decode("utf-8")

        headers["AUTHORIZATION"] = f"Basic {base64header}"
        return await method(*args, headers=headers, **kwargs)

    return _job_authenticated


@pytest.fixture
def spawn_job_client(
        dbi,
        create_app,
        create_user,
        aiohttp_client,
        spawn_client,
):
    """A factory method for creating an aiohttp client which can authenticate with the API as a Job."""

    async def _spawn_job_client(
            auth=None,
            authorize=False,
            administrator=False,
            dev=False,
            enable_api=False,
            groups=None,
            permissions=None
    ):
        # Create a test job to use for authentication.
        job_id, key = "test_job", "test_key"
        await dbi.jobs.insert_one({
            "_id": job_id,
            "key": key,
        })

        # Spawn a test client.
        test_client = await spawn_client(auth, authorize, administrator, dev, enable_api, groups, permissions)
        client = test_client._test_client
        client.db = dbi

        # Enable the API in the settings.
        client.settings = test_client.settings
        client.settings["enable_api"] = True

        # Set the `AUTHORIZATION` header before each request.
        client.delete = job_authenticated(client.delete, job_id, key)
        client.get = job_authenticated(client.get, job_id, key)
        client.patch = job_authenticated(client.patch, job_id, key)
        client.post = job_authenticated(client.post, job_id, key)
        client.put = job_authenticated(client.put, job_id, key)

        return client

    return _spawn_job_client
