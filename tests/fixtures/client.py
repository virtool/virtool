from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import aiohttp
import pytest
from aiohttp.web_routedef import RouteTableDef
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.session import Session

import virtool.app
import virtool.jobs.main
from virtool.api.custom_json import dump_bytes
from virtool.authorization.client import AuthorizationClient
from virtool.config.cls import ServerConfig
from virtool.mongo.core import Mongo
from virtool.mongo.identifier import FakeIdProvider
from virtool.users.utils import generate_base_permissions
from virtool.utils import hash_key


class VirtoolTestClient:
    def __init__(self, test_client):
        self._test_client = test_client

        self.server = self._test_client.server
        self.app = self.server.app
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

    async def get(self, url, headers=None, params=None):
        return await self._test_client.get(url, headers=headers, params=params)

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
    mongo: "Mongo",
    pg_connection_string: str,
    redis_connection_string: str,
        mongo_connection_string,
        mongo_name,
    openfga_store_name: str,
):
    mongodb_connection_string = (
        f"{mongo_connection_string}/{mongo_name}?authSource=admin"
    )

    def func(
        base_url: str = "",
        dev: bool = False,
        use_b2c: bool = False,
        config_overrides: Optional[dict[str, Any]] = None,
    ):
        config = ServerConfig(
            base_url=base_url,
            b2c_client_id="",
            b2c_client_secret="",
            b2c_tenant="",
            b2c_user_flow="",
            data_path=Path("data"),
            dev=dev,
            host="localhost",
            mongodb_connection_string=mongodb_connection_string,
            no_check_db=True,
            no_check_files=True,
            no_revision_check=True,
            openfga_host="localhost:8080",
            openfga_scheme="http",
            openfga_store_name=openfga_store_name,
            port=9950,
            postgres_connection_string=pg_connection_string,
            redis_connection_string=redis_connection_string,
            sentry_dsn="",
            use_b2c=use_b2c,
        )

        if config_overrides:
            for key, value in config_overrides.items():
                setattr(config, key, value)

        return virtool.app.create_app(config)

    return func


@pytest.fixture
def spawn_client(
    aiohttp_client,
    authorization_client,
    create_app,
    create_user,
    mongo,
    pg,
    redis,
    test_motor,
):
    async def func(
        addon_route_table: Optional[RouteTableDef] = None,
        auth=None,
        authorize=False,
        administrator=False,
        base_url="",
        dev=False,
        groups=None,
        permissions=None,
        use_b2c=False,
        config_overrides: Optional[dict[str, Any]] = None,
    ):
        app = create_app(base_url, dev, use_b2c)

        if groups is not None:
            await mongo.groups.insert_many(
                [
                    {
                        "_id": group,
                        "name": group,
                        "permissions": generate_base_permissions(),
                    }
                    for group in groups
                ],
                session=None,
            )

        await mongo.users.insert_one(
            await create_user(
                user_id="test",
                administrator=administrator,
                groups=groups,
                permissions=permissions,
                authorization_client=authorization_client if administrator else None,
            )
        )

        if addon_route_table:
            app.add_routes(addon_route_table)

        if authorize:
            session_token = "bar"
            session_id = "foobar"
            await redis.set(
                session_id,
                dump_bytes(
                    Session(
                        **{
                            "created_at": virtool.utils.timestamp(),
                            "ip": "127.0.0.1",
                            "authentication": {
                                "token": hash_key(session_token),
                                "user_id": "test",
                            },
                        }
                    )
                ),
                expire=3600,
            )

            cookies = {"session_id": session_id, "session_token": session_token}

        elif use_b2c:
            cookies = {"id_token": "foobar"}

        else:
            cookies = {"session_id": "dne"}

        test_client = await aiohttp_client(
            app, auth=auth, cookies=cookies, auto_decompress=False
        )

        test_client.app["db"].id_provider = FakeIdProvider()

        return VirtoolTestClient(test_client)

    return func


@pytest.fixture
def spawn_job_client(
    mongo: "Mongo",
    aiohttp_client,
        mongo_connection_string,
    redis_connection_string: str,
    pg_connection_string: str,
    pg: AsyncEngine,
        mongo_name,
    openfga_store_name: str,
    authorization_client: AuthorizationClient,
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
            await mongo.jobs.insert_one(
                {
                    "_id": job_id,
                    "key": hash_key(key),
                }
            )

            # Create Basic Authentication header.
            auth = aiohttp.BasicAuth(login=f"job-{job_id}", password=key)
        else:
            auth = None

        app = await virtool.jobs.main.create_app(
            ServerConfig(
                base_url="",
                b2c_client_id="",
                b2c_client_secret="",
                b2c_tenant="",
                b2c_user_flow="",
                data_path=Path("data"),
                dev=dev,
                host="localhost",
                mongodb_connection_string=f"{mongo_connection_string}/{mongo_name}?authSource=admin",
                no_check_db=True,
                no_check_files=True,
                no_revision_check=True,
                openfga_host="localhost:8080",
                openfga_scheme="http",
                openfga_store_name=openfga_store_name,
                port=9950,
                postgres_connection_string=pg_connection_string,
                redis_connection_string=redis_connection_string,
                sentry_dsn="",
                use_b2c=False,
            )
        )

        if add_route_table:
            app.add_routes(add_route_table)

        client = await aiohttp_client(app, auth=auth, auto_decompress=False)
        client.db = mongo

        return client

    return _spawn_job_client
