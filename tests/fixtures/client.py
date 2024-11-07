"""Fixtures for creating test clients that can be used to test API endpoints."""

import json
from pathlib import Path
from typing import Any, Protocol

import pytest
from aiohttp import BasicAuth, ClientResponse
from aiohttp.web import RouteTableDef
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.enums import Permission
from virtool_core.models.group import GroupMinimal
from virtool_core.models.roles import AdministratorRole
from virtool_core.models.user import User
from virtool_core.redis import Redis

import virtool.jobs.main
from virtool.api.custom_json import dump_string
from virtool.app import create_app
from virtool.authorization.client import AuthorizationClient
from virtool.authorization.openfga import OpenfgaScheme
from virtool.config.cls import ServerConfig
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.flags import FeatureFlags, FlagName
from virtool.groups.oas import PermissionsUpdate
from virtool.mongo.core import Mongo
from virtool.mongo.identifier import FakeIdProvider
from virtool.mongo.utils import get_mongo_from_app
from virtool.users.oas import UpdateUserRequest
from virtool.utils import hash_key


class VirtoolTestClientUser:
    """Manages the user associated with a test client."""

    def __init__(self, data_layer: DataLayer, tester_user: User):
        self._data_layer = data_layer

        self.groups: list[GroupMinimal] = tester_user.groups
        """The groups the user belongs to."""

        self.id = tester_user.id
        """The user's unique identifier."""

    async def set_groups(self, group_ids: list[int]):
        """Set the groups the user belongs to.

        .. code-block:: python

           # Spawn a client.
           client = await spawn_client(authenticated=True)

           # Set a user's groups by providing a list of group IDs.
           await client.user.set_groups([1, 3])

           # [
           #   GroupMinimal(id=1, name="Administrator"),
           #   GroupMinimal(id=3, name="Testers")
           # ]
           print(client.user.groups)


        :param group_ids: the groups the user will be a member of
        :return: the user
        """
        user = await self._data_layer.users.update(
            self.id,
            UpdateUserRequest(groups=group_ids),
        )

        self.groups = user.groups


class VirtoolTestClient:
    """The test client provided by the :fixture:`spawn_client` fixture."""

    def __init__(self, test_client, test_client_user: VirtoolTestClientUser):
        self._test_client = test_client

        self.app = self._test_client.server.app
        """The test server's application object."""

        self.mongo = get_mongo_from_app(self.app)
        """The server Mongo object."""

        self.pg: AsyncEngine = self.app["pg"]
        """The server SQLAlchemy engine."""

        self.redis: Redis = self.app["redis"]

        self.user: VirtoolTestClientUser = test_client_user
        """
        The user associated with the client.
        
        This attribute will be ``None`` if the client is not authenticated.
        """

    async def set_user(self, user_id: str):
        """Authenticate the client as a specific existing user.

        The :attr:`user` attribute will be updated to reflect the new user.

        :param user_id: the ID of the user to authenticate as
        :return:
        """
        data_layer = get_data_from_app(self.app)

        self.user = VirtoolTestClientUser(
            data_layer,
            await data_layer.users.get(user_id),
        )

    async def get(
        self,
        url: str,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
    ) -> ClientResponse:
        return await self._test_client.get(url, headers=headers, params=params)

    async def post(self, url: str, data: dict | None) -> ClientResponse:
        payload = None

        if data:
            payload = dump_string(data)

        return await self._test_client.post(url, data=payload)

    async def post_form(self, url: str, data) -> ClientResponse:
        return await self._test_client.post(url, data=data)

    async def patch(self, url: str, data) -> ClientResponse:
        return await self._test_client.patch(url, data=json.dumps(data))

    async def put(self, url: str, data) -> ClientResponse:
        return await self._test_client.put(url, data=json.dumps(data))

    async def delete(self, url: str) -> ClientResponse:
        return await self._test_client.delete(url)


class JobClientSpawner(Protocol):
    """A protocol the describes a function that can spawn a test job client.

    The fixture :func:`spawn_job_client` returns a function that conforms to this
    protocol.
    """

    async def __call__(
        self,
        add_route_table: RouteTableDef | None = None,
        auth: BasicAuth | None = None,
        authenticated: bool = False,
        base_url: str = "",
        dev: bool = False,
    ) -> VirtoolTestClient:
        """Spawn a test job client.

        :param add_route_table: a route table that will be added to the app
        :param authenticated: whether the client should be authenticated
        :param dev: whether the client should be in development mode
        :return: the test client
        """
        ...


class ClientSpawner(Protocol):
    """A protocol the describes a function that can spawn a user test client.

    The fixture :func:`spawn_client` returns a function that conforms to this protocol.
    """

    async def __call__(
        self,
        addon_route_table: RouteTableDef | None = None,
        administrator: bool = False,
        auth: BasicAuth | None = None,
        authenticated: bool = False,
        base_url: str = "",
        dev: bool = False,
        flags: list[FlagName] | None = None,
        permissions: list[Permission] | None = None,
    ) -> VirtoolTestClient:
        """Spawn a test client.

        :param addon_route_table: a route table that will be added to the app
        :param administrator: whether the client should be an administrator
        :param auth: a basic authentication object to use
        :param authenticated: whether the client should be authenticated
        :param base_url: the base URL to use for the client
        :param config_overrides: overrides for the server config
        :param flags: a list of feature flags to enable
        :param permissions: a list of permissions to give the user
        :return: the test client
        """


@pytest.fixture()
def spawn_client(
    aiohttp_client,
    authorization_client: AuthorizationClient,
    data_path: Path,
    fake: DataFaker,
    mocker,
    mongo: Mongo,
    mongo_connection_string: str,
    mongo_name: str,
    openfga_host: str,
    openfga_scheme: OpenfgaScheme,
    openfga_store_name: str,
    pg_connection_string: str,
    pg: AsyncEngine,
    redis: Redis,
    redis_connection_string: str,
) -> ClientSpawner:
    """A factory for spawning test clients

    The function conforms to the :class:`ClientSpawner` protocol, which describes which
    configuration arguments can be passed to the function.

    When clients are created, a testing server instance is also created. All methods
    called on the client (eg. ``await client.get("/samples")``) are directed to the
    server instance.

    Basic Usage
    -----------

    The simplest usage of the test client spawn a client that is unauthenticated and
    unprivileged.

    .. code-block:: python

        async def test_get(spawn_client: ClientSpawner):
            client = await spawn_client()

            resp = await client.get("/")

            assert resp.status == 200

    The client can be authenticated as fake user by setting the ``authenticated`` flag.

    .. code-block:: python

        client = await spawn_client(authenticated=True)

    This automatically:

    1. Creates a fake user.
    2. Creates an authenticated session for the user.
    3. Sets the test client cookies to use the session.

    This means that the client can be used to test any endpoints that don't require
    administrator privileges.

    The client can be authenticated as an administrator by setting the ``administrator``
    flag.

    .. code-block:: python

        client = await spawn_client(administrator=True)

    This allows the client to test any endpoint. The ``authenticated`` flag must still
    be used when the ``administrator`` flag is used.

    Permissions
    -----------

    The permissions of the user can be set by passing a list of permissions when the
    client is spawned.

    .. code-block:: python

        client = await spawn_client(
            authenticated=True,
            permissions=[Permission.create_sample, Permission.create_subtraction]
        )

    This will create a one-off group with the specified permissions and assign the user
    to it.

    Feature Flags
    -------------

    The feature flags enabled on the test server can be configured **only** when
    spawning the client.

    .. code-block:: python

        client = await spawn_client(flags=[FlagName.ML_MODELS, FlagName.SPACES])

    This will enable the ``ML_MODELS`` and ``SPACES`` feature flags on the test server
    so that features that are not generally available can still be tested.

    Server Configuration
    --------------------

    The basic configuration of the test server can be overridden by passing a dictionary
    of configuration value keys and replacement values as ``config_overrides``.

    .. code-block:: python

        client = await spawn_client(
            config_overrides={"base_url": "https://virtool.example.com"}
        )

    Attempts to override invalid configuration values will raise an exception.

    Addon Routes
    ------------

    Additional routes can be added to the test server by passing an instance of
    :class:`RouteTableDef` as ``addon_route_table`` when spawning the client.

    .. code-block:: python

        client = await spawn_client(authenticated=True, addon_route_table=Routes)

    """

    async def func(
        addon_route_table: RouteTableDef | None = None,
        administrator: bool = False,
        auth: BasicAuth | None = None,
        authenticated: bool = False,
        base_url: str = "",
        dev: bool = False,
        flags: list[FlagName] | None = None,
        permissions: list[Permission] | None = None,
    ):
        """:param addon_route_table:
        :param administrator: whether the client should be an administrator
        :param auth: a basic authentication object to use
        :param authenticated: whether the client should be authenticated
        :param base_url:
        :param dev:
        :param flags:
        :param permissions:
        :return:
        """
        config = ServerConfig(
            base_url=base_url,
            b2c_client_id="",
            b2c_client_secret="",
            b2c_tenant="",
            b2c_user_flow="",
            data_path=data_path,
            dev=dev,
            flags=[],
            host="localhost",
            mongodb_connection_string=f"{mongo_connection_string}/{mongo_name}?authSource=admin",
            no_check_db=True,
            no_revision_check=True,
            openfga_host=openfga_host,
            openfga_scheme=openfga_scheme,
            openfga_store_name=openfga_store_name,
            port=9950,
            postgres_connection_string=pg_connection_string,
            real_ip_header="",
            redis_connection_string=redis_connection_string,
            sentry_dsn="",
            use_b2c=False,
        )

        mocker.patch(
            "virtool.startup.connect_authorization_client",
            return_value=authorization_client,
        )
        mocker.patch("virtool.startup.connect_pg", return_value=pg)
        mocker.patch("virtool.startup.connect_mongo", return_value=mongo)
        mocker.patch("virtool.startup._connect_redis", return_value=redis)

        app = create_app(config)

        if addon_route_table:
            app.add_routes(addon_route_table)

        groups = []

        if permissions:
            groups = [
                await fake.groups.create(
                    permissions=PermissionsUpdate(
                        **{
                            permission: True
                            for permission in permissions
                            if permission in permissions
                        },
                    ),
                ),
            ]

        test_client_user = await fake.users.create(
            administrator_role=AdministratorRole.FULL if administrator else None,
            groups=groups,
            handle="bob",
            password="bob_is_testing",
        )

        if authenticated:
            session_id = "foobar"
            session_token = "bar"

            await redis.set(
                session_id,
                dump_string(
                    {
                        "authentication": {
                            "token": hash_key(session_token),
                            "user_id": test_client_user.id,
                        },
                        "created_at": virtool.utils.timestamp(),
                        "id": session_id,
                        "ip": "127.0.0.1",
                    },
                ),
                expire=3600,
            )

            cookies = {"session_id": session_id, "session_token": session_token}

        elif config.use_b2c:
            cookies = {"id_token": "foobar"}
        else:
            cookies = {"session_id": "dne"}

        test_client = await aiohttp_client(
            app,
            auth=auth,
            auto_decompress=False,
            cookies=cookies,
        )

        get_mongo_from_app(test_client.app).id_provider = FakeIdProvider()

        if flags:
            test_client.app["flags"] = FeatureFlags(flags)

        client = VirtoolTestClient(test_client, test_client_user)

        return client

    return func


@pytest.fixture()
def spawn_job_client(
    aiohttp_client,
    data_path: Path,
    mongo: Mongo,
    mongo_connection_string,
    mongo_name: str,
    openfga_host: str,
    openfga_store_name: str,
    pg: AsyncEngine,
    pg_connection_string: str,
    redis_connection_string: str,
    mocker,
) -> JobClientSpawner:
    """A factory method for creating an aiohttp client which can authenticate with the
    API as a Job.
    """

    async def func(
        add_route_table: RouteTableDef = None,
        authenticated: bool = False,
        base_url: str = "",
        dev: bool = False,
    ):
        if authenticated:
            # Create a test job to use for authentication.
            job_id, key = "test_job", "test_key"

            await mongo.jobs.insert_one(
                {"_id": "test_job", "key": hash_key("test_key")},
            )

            # Create Basic Authentication header.
            auth = BasicAuth(login=f"job-{job_id}", password=key)
        else:
            auth = None

        mocker.patch("virtool.startup.connect_pg", return_value=pg)

        app = await virtool.jobs.main.create_app(
            ServerConfig(
                base_url=base_url,
                b2c_client_id="",
                b2c_client_secret="",
                b2c_tenant="",
                b2c_user_flow="",
                data_path=data_path,
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
                real_ip_header="",
                redis_connection_string=redis_connection_string,
                sentry_dsn="",
                use_b2c=False,
            ),
        )

        if add_route_table:
            app.add_routes(add_route_table)

        client = await aiohttp_client(app, auth=auth, auto_decompress=False)

        return client

    return func
