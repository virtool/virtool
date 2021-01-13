import json
import pytest

import virtool.app
import virtool.users.utils


class VTClient:

    def __init__(self, loop, test_client, db_connection_string, postgres_connection_string, db_name, create_user):
        self._loop = loop
        self._test_client = test_client
        self._create_user = create_user
        self._db_connection_string = db_connection_string
        self._postgres_connection_string = postgres_connection_string
        self._db_name = db_name
        self._client = None
        self.settings = None
        self.server = None
        self.app = None
        self.db = None

    async def connect(
            self,
            authorize=False,
            administrator=False,
            groups=None,
            permissions=None
    ):
        app = virtool.app.create_app({
            "db_connection_string": self._db_connection_string,
            "postgres_connection_string": self._postgres_connection_string,
            "db_name": self._db_name,
            "enable_api": True,
            "force_version": "v0.0.0",
            "no_client": True,
            "no_check_db": True,
            "no_check_files": True,
            "no_file_manager": True,
            "no_fetching": True,
            "no_job_interface": True,
            "no_sentry": True
        })

        self._client = await self._test_client(app)

        self._client.session.cookie_jar.update_cookies({
            "session_id": "foobar"
        })

        self.server = self._client.server
        self.app = self.server.app
        self.db = self.app.get("db", None)

        if authorize:
            user_document = self._create_user("test", administrator, groups, permissions)

            await self.db.users.insert_one(user_document)

            await self.db.sessions.insert_one({
                "_id": "foobar",
                "ip": "127.0.0.1",
                "administrator": administrator,
                "user_agent": "Python/3.6 aiohttp/3.4.4",
                "user": {
                    "id": "test"
                },
                "groups": user_document["groups"],
                "permissions": user_document["permissions"]
            })

        return self

    async def get(self, url, params=None):
        return await self._client.get(url, params=params)

    async def post(self, url, data=None):
        payload = None

        if data:
            payload = json.dumps(data)

        return await self._client.post(url, data=payload)

    async def post_form(self, url, data):
        return await self._client.post(url, data=data)

    async def patch(self, url, data):
        return await self._client.patch(url, data=json.dumps(data))

    async def put(self, url, data):
        return await self._client.put(url, data=json.dumps(data))

    async def delete(self, url):
        return await self._client.delete(url)


@pytest.fixture
def spawn_client(loop, request, aiohttp_client, test_motor, test_db_name, test_session, create_user):
    db_connection_string = request.config.getoption("db_connection_string", "mongodb://localhost:27017")
    postgres_connection_string = request.config.getoption("postgres_connection_string")

    client = VTClient(loop, aiohttp_client, db_connection_string, postgres_connection_string, test_db_name, create_user)

    return client.connect
