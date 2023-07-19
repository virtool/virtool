"""
Fixtures for creating test clients.

When clients are created, a testing server instance is also created. All methods called
on the client (eg. ``client.get()``) are directed to the server instance.

"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from aiohttp import BasicAuth
from aiohttp.web import Response, RouteTableDef
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.enums import Permission
from virtool_core.models.session import Session

import virtool.jobs.main
from virtool.api.custom_json import dump_bytes, dump_string
from virtool.app import create_app
from virtool.authorization.client import AuthorizationClient
from virtool.config.cls import ServerConfig
from virtool.flags import FlagName, FeatureFlags
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

    def get_cookie(self, key) -> Any | None:
        for cookie in self._test_client.session.cookie_jar:
            if cookie.key == key:
                return cookie.value

        return None

    def has_cookie(self, key, value):
        return self.get_cookie(key) == value

    async def get(self, url: str, headers=None, params=None) -> Response:
        return await self._test_client.get(url, headers=headers, params=params)

    async def post(self, url: str, data=None) -> Response:
        payload = None

        if data:
            payload = dump_string(data)

        return await self._test_client.post(url, data=payload)

    async def post_form(self, url: str, data) -> Response:
        return await self._test_client.post(url, data=data)

    async def patch(self, url: str, data) -> Response:
        return await self._test_client.patch(url, data=json.dumps(data))

    async def put(self, url: str, data) -> Response:
        return await self._test_client.put(url, data=json.dumps(data))

    async def delete(self, url: str) -> Response:
        return await self._test_client.delete(url)


@pytest.fixture
def spawn_client(
    aiohttp_client,
    authorization_client,
    create_user,
    mongo,
    mongo_connection_string,
    mongo_name,
    openfga_host,
    openfga_scheme,
    openfga_store_name,
    pg_connection_string,
    pg,
    redis,
    redis_connection_string,
    test_motor,
):
    """A factory for spawning test clients."""

    async def func(
        addon_route_table: RouteTableDef | None = None,
        administrator: bool = False,
        auth: BasicAuth | None = None,
        authenticated: bool = False,
        authorize: bool = False,
        base_url: str = "",
        config_overrides: dict[str, Any] | None = None,
        flags: list[FlagName] | None = None,
        groups: list[str] | None = None,
        permissions: list[Permission] | None = None,
    ):
        authenticated = authenticated or authorize

        config = ServerConfig(
            base_url=base_url,
            b2c_client_id="",
            b2c_client_secret="",
            b2c_tenant="",
            b2c_user_flow="",
            data_path=Path("data"),
            dev=False,
            flags=[],
            host="localhost",
            mongodb_connection_string=f"{mongo_connection_string}/{mongo_name}?authSource=admin",
            no_check_db=True,
            no_revision_check=True,
            openfga_host=openfga_host,
            openfga_scheme="http",
            openfga_store_name=openfga_store_name,
            port=9950,
            postgres_connection_string=pg_connection_string,
            redis_connection_string=redis_connection_string,
            sentry_dsn="",
            use_b2c=False,
        )

        if config_overrides:
            for key, value in config_overrides.items():
                setattr(config, key, value)

        app = create_app(config)

        if addon_route_table:
            app.add_routes(addon_route_table)

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

        if permissions is not None:
            await mongo.groups.insert_one(
                {
                    "_id": "perms_group",
                    "name": "perms_group",
                    "permissions": {
                        permission.value: True for permission in permissions
                    },
                }
            )
            groups = ["perms_group"] if groups is None else ["perms_group", *groups]

        await mongo.users.insert_one(
            await create_user(
                user_id="test",
                administrator=administrator,
                groups=groups,
                authorization_client=authorization_client if administrator else None,
            )
        )

        if authenticated:
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

        elif config.use_b2c:
            cookies = {"id_token": "foobar"}
        else:
            cookies = {"session_id": "dne"}

        test_client = await aiohttp_client(
            app, auth=auth, cookies=cookies, auto_decompress=False
        )

        test_client.app["db"].id_provider = FakeIdProvider()

        if flags:
            test_client.app["flags"] = FeatureFlags(flags)

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
    openfga_host: str,
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
            await mongo.jobs.insert_one({"_id": job_id, "key": hash_key(key)})

            # Create Basic Authentication header.
            auth = BasicAuth(login=f"job-{job_id}", password=key)
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
                flags=[],
                host="localhost",
                mongodb_connection_string=f"{mongo_connection_string}/{mongo_name}?authSource=admin",
                no_check_db=True,
                no_revision_check=True,
                openfga_host=openfga_host,
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
