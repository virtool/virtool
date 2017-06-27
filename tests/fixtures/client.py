import json
import pytest
import pymongo

from virtool.app import create_app


@pytest.fixture
def authorize_client(test_db, create_user):
    async def func(client, groups, permissions):
        resp = await client.get("/api")

        user_document = create_user("test", groups, permissions)

        test_db.users.insert(user_document)

        test_db.sessions.find_one_and_update({"_id": resp.cookies["session_id"].value}, {
            "$set": {
                "user_id": "test",
                "groups": user_document["groups"],
                "permissions": user_document["permissions"]
            }
        }, return_document=pymongo.ReturnDocument.AFTER)

        return client

    return func


@pytest.fixture
def do_get(test_client, authorize_client):

    class DoGet:

        def __init__(self):
            self.client = None
            self.server = None

        async def init_client(self):
            self.client = await test_client(create_app, "test")
            self.server = self.client.server

        async def __call__(self, url, authorize=False, groups=None, permissions=None):
            if not self.client:
                await self.init_client()

            if authorize:
                await authorize_client(self.client, groups, permissions)

            return await self.client.get(url)

    return DoGet()


@pytest.fixture
def do_post(test_client, authorize_client):
    client = None

    async def func(url, data, authorize=False, groups=None, permissions=None):
        nonlocal client
        client = client or await test_client(create_app, "test")

        if authorize:
            await authorize_client(client, groups, permissions)

        return await client.post(url, data=json.dumps(data))

    return func


@pytest.fixture
def do_upload(test_client, authorize_client):
    client = None

    async def func(url, data, authorize=False, groups=None, permissions=None):
        nonlocal client
        client = client or await test_client(create_app, "test")

        if authorize:
            await authorize_client(client, groups, permissions)

        return await client.post(url, data=data)

    return func


@pytest.fixture
def do_put(test_client, authorize_client):
    client = None

    async def func(url, data, authorize=False, groups=None, permissions=None):
        nonlocal client

        client = client or await test_client(create_app, "test")

        if authorize:
            await authorize_client(client, groups, permissions)

        return await client.put(url, data=json.dumps(data))

    return func


@pytest.fixture
def do_patch(test_client, authorize_client):
    client = None

    async def func(url, data, authorize=False, groups=None, permissions=None):
        nonlocal client

        client = client or await test_client(create_app, "test")

        if authorize:
            await authorize_client(client, groups, permissions)

        return await client.patch(url, data=json.dumps(data))

    return func


@pytest.fixture
def do_delete(test_client, authorize_client):
    client = None

    async def func(url, authorize=False, groups=None, permissions=None):
        nonlocal client

        client = client or await test_client(create_app, "test")

        if authorize:
            await authorize_client(client, groups, permissions)

        return await client.delete(url)

    return func
