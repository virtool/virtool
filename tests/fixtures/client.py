import json

import aiohttp
import pytest
from aiohttp.web_routedef import RouteTableDef

import virtool.app
import virtool.jobs_api.main
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
            "no_sentry": True
        })

    return _create_app


@pytest.fixture
def spawn_client(
        pg,
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

        test_client = await aiohttp_client(app, auth=auth, cookies=cookies, auto_decompress=False)

        return VirtoolTestClient(test_client)

    return func


@pytest.fixture
def spawn_job_client(
        dbi,
        aiohttp_client,
        test_db_connection_string,
        redis_connection_string,
        pg_connection_string,
        pg_session,
        test_db_name
):
    """A factory method for creating an aiohttp client which can authenticate with the API as a Job."""

    async def _spawn_job_client(
            authorize: bool = False,
            dev: bool = False,
            add_route_table: RouteTableDef = None,
    ):
        # Create a test job to use for authentication.
        if authorize:
            job_id, key = "test_job", "test_key"
            await dbi.jobs.insert_one({
                "_id": job_id,
                "key": hash_key(key),
            })

            # Create Basic Authentication header.
            auth = aiohttp.BasicAuth(login=f"job-{job_id}", password=key)
        else:
            auth = None

        app = await virtool.jobs_api.main.create_app(
            db_connection_string=test_db_connection_string,
            db_name=test_db_name,
            dev=dev,
            postgres_connection_string=pg_connection_string,
            redis_connection_string=redis_connection_string,
        )

        if add_route_table:
            app.add_routes(add_route_table)

        client = await aiohttp_client(app, auth=auth, auto_decompress=False)
        client.db = dbi
        client.settings = app["settings"]

        return client

    return _spawn_job_client
