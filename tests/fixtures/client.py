import json
import pytest

import virtool.app
import virtool.user


class VTClient:

    def __init__(self, test_client, test_db_name, create_user):
        self._test_client = test_client
        self._create_user = create_user
        self._test_db_name = test_db_name
        self._client = None

        self.server = None
        self.app = None
        self.db = None

    async def connect(self, authorize=False, groups=None, permissions=None, job_manager=False, file_manager=False,
                      setup_mode=False):

        self._client = await self._test_client(
            virtool.app.create_app,
            self._test_db_name,
            disable_job_manager=not job_manager,
            disable_file_manager=not file_manager,
            skip_setup=not setup_mode,
            no_sentry=True
        )

        self._client.session.cookie_jar.update_cookies({
            "session_id": "foobar"
        })

        self.server = self._client.server
        self.app = self.server.app
        self.db = self.app.get("db", None)

        if authorize:
            user_document = self._create_user("test", groups, permissions)

            await self.db.users.insert_one(user_document)

            await self.db.sessions.insert_one({
                "_id": "foobar",
                "ip": "127.0.0.1",
                "user_agent": "Python/3.6 aiohttp/2.3.3",
                "user": {
                    "id": "test"
                },
                "groups": user_document["groups"],
                "permissions": user_document["permissions"]
            })

        return self

    async def get(self, url):
        return await self._client.get(url)

    async def post(self, url, data):
        return await self._client.post(url, data=json.dumps(data))

    async def post_form(self, url, data):
        return await self._client.post(url, data=data)

    async def patch(self, url, data):
        return await self._client.patch(url, data=json.dumps(data))

    async def put(self, url, data):
        return await self._client.put(url, data=json.dumps(data))

    async def delete(self, url):
        return await self._client.delete(url)


@pytest.fixture
def spawn_client(test_client, test_motor, test_db_name, create_user):
    client = VTClient(test_client, test_db_name, create_user)
    return client.connect
