"""Fixtures for creating test clients that can be used to test API endpoints."""

import json
from pathlib import Path
from typing import Any, Protocol

import arrow
import pytest
from aiohttp import BasicAuth, ClientResponse
from aiohttp.web import RouteTableDef
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.jobs.main
import virtool.tasks.main
from virtool.api.custom_json import dump_string
from virtool.app import create_app
from virtool.config.cls import ServerConfig, TaskRunnerConfig
from virtool.data.layer import DataLayer
from virtool.data.utils import get_data_from_app
from virtool.fake.next import DataFaker
from virtool.flags import FeatureFlags, FlagName
from virtool.groups.models import GroupMinimal
from virtool.groups.oas import PermissionsUpdate
from virtool.identifier import AbstractIdProvider
from virtool.jobs.pg import SQLJob
from virtool.models.enums import Permission
from virtool.models.roles import AdministratorRole
from virtool.users.models import User
from virtool.users.oas import UpdateUserRequest
from virtool.users.pg import SQLUser
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

    def __init__(self, test_client, test_client_user: VirtoolTestClientUser | None):
        self._test_client = test_client

        self.app = self._test_client.server.app
        """The test server's application object."""

        self.cookie_jar = self._test_client.session.cookie_jar
        """The cookie jar for the test client session."""

        self.user: VirtoolTestClientUser | None = test_client_user
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
        cookies: dict[str, str] | None = None,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
    ) -> ClientResponse:
        merged_cookies = {}
        for cookie in self.cookie_jar:
            merged_cookies[cookie.key] = cookie.value
        if cookies:
            merged_cookies.update(cookies)

        return await self._test_client.get(
            url, cookies=merged_cookies or None, headers=headers, params=params
        )

    async def post(
        self,
        url: str,
        data: dict | None = None,
        cookies: dict[str, str] | None = None,
    ) -> ClientResponse:
        payload = None

        if data:
            payload = dump_string(data)

        merged_cookies = {}
        for cookie in self.cookie_jar:
            merged_cookies[cookie.key] = cookie.value
        if cookies:
            merged_cookies.update(cookies)

        return await self._test_client.post(
            url, data=payload, cookies=merged_cookies or None
        )

    async def post_form(
        self,
        url: str,
        data,
        cookies: dict[str, str] | None = None,
    ) -> ClientResponse:
        merged_cookies = {}
        for cookie in self.cookie_jar:
            merged_cookies[cookie.key] = cookie.value
        if cookies:
            merged_cookies.update(cookies)

        return await self._test_client.post(
            url, data=data, cookies=merged_cookies or None
        )

    async def patch(
        self,
        url: str,
        data,
        cookies: dict[str, str] | None = None,
    ) -> ClientResponse:
        merged_cookies = {}
        for cookie in self.cookie_jar:
            merged_cookies[cookie.key] = cookie.value
        if cookies:
            merged_cookies.update(cookies)

        return await self._test_client.patch(
            url, data=json.dumps(data), cookies=merged_cookies or None
        )

    async def put(
        self,
        url: str,
        data,
        cookies: dict[str, str] | None = None,
    ) -> ClientResponse:
        merged_cookies = {}
        for cookie in self.cookie_jar:
            merged_cookies[cookie.key] = cookie.value
        if cookies:
            merged_cookies.update(cookies)

        return await self._test_client.put(
            url, data=json.dumps(data), cookies=merged_cookies or None
        )

    async def delete(
        self,
        url: str,
        cookies: dict[str, str] | None = None,
    ) -> ClientResponse:
        merged_cookies = {}
        for cookie in self.cookie_jar:
            merged_cookies[cookie.key] = cookie.value
        if cookies:
            merged_cookies.update(cookies)

        return await self._test_client.delete(url, cookies=merged_cookies or None)


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
        flags: list[FlagName] | None = None,
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


@pytest.fixture
def spawn_client(
    aiohttp_client,
    data_layer: DataLayer,
    tmp_path: Path,
    fake: DataFaker,
    memory_storage,
    mocker,
    id_provider: AbstractIdProvider,
    pg_connection_string: str,
    pg: AsyncEngine,
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

            assert resp.status == HTTPStatus.OK

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

        client = await spawn_client(flags=[FlagName.ADMINISTRATOR_ROLES])

    This will enable the named feature flags on the test server so that features
    that are not generally available can still be tested.

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
            dev=dev,
            flags=[],
            host="localhost",
            no_periodic_tasks=True,
            no_revision_check=True,
            port=9950,
            postgres_connection_string=pg_connection_string,
            real_ip_header="",
            sentry_dsn="",
            storage_backend="s3",
            storage_s3_bucket="test-bucket",
        )

        mocker.patch("virtool.startup.connect_pg", return_value=pg)
        mocker.patch(
            "virtool.startup.create_storage_backend",
            return_value=memory_storage,
        )

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

        test_client_user = None
        if authenticated:
            test_client_user = await fake.users.create(
                administrator_role=AdministratorRole.FULL if administrator else None,
                groups=groups,
                password="bob_is_testing",
            )

        if authenticated:
            session, session_token = await data_layer.sessions.create_authenticated(
                "127.0.0.1",
                test_client_user.id,
                remember=False,
            )

            cookies = {"session_id": session.id, "session_token": session_token}

        else:
            cookies = {}

        test_client = await aiohttp_client(
            app,
            auth=auth,
            auto_decompress=False,
            cookies=cookies,
        )

        get_data_from_app(test_client.app).otus._id_provider = id_provider

        if flags:
            test_client.app["flags"] = FeatureFlags(flags)

        client = VirtoolTestClient(test_client, test_client_user)

        return client

    return func


@pytest.fixture
def spawn_job_client(
    aiohttp_client,
    tmp_path: Path,
    memory_storage,
    pg: AsyncEngine,
    pg_connection_string: str,
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
        flags: list[FlagName] | None = None,
    ):
        if authenticated:
            key = "test_key"

            async with AsyncSession(pg) as session:
                test_user = SQLUser(
                    handle="test_job_user",
                    password=b"",
                    force_reset=False,
                    last_password_change=arrow.utcnow().naive,
                    settings={},
                )
                session.add(test_user)
                await session.flush()

                test_job = SQLJob(
                    acquired=True,
                    created_at=arrow.utcnow().naive,
                    key=hash_key(key),
                    state="running",
                    user_id=test_user.id,
                    workflow="nuvs",
                )
                session.add(test_job)
                await session.flush()
                job_id = test_job.id
                await session.commit()

            auth = BasicAuth(login=f"job-{job_id}", password=key)
        else:
            auth = None

        mocker.patch("virtool.startup.connect_pg", return_value=pg)
        mocker.patch(
            "virtool.startup.create_storage_backend",
            return_value=memory_storage,
        )

        app = await virtool.jobs.main.create_app(
            ServerConfig(
                base_url=base_url,
                dev=dev,
                flags=[],
                host="localhost",
                no_periodic_tasks=True,
                no_revision_check=True,
                port=9950,
                postgres_connection_string=pg_connection_string,
                real_ip_header="",
                sentry_dsn="",
                storage_backend="s3",
                storage_s3_bucket="test-bucket",
            ),
        )

        if add_route_table:
            app.add_routes(add_route_table)

        client = await aiohttp_client(app, auth=auth, auto_decompress=False)

        if flags:
            client.app["flags"] = FeatureFlags(flags)

        return client

    return func


class TaskRunnerClientSpawner(Protocol):
    """A protocol describing a function that spawns a task runner test client.

    The fixture :func:`spawn_task_runner_client` returns a function that conforms to
    this protocol.
    """

    async def __call__(self) -> VirtoolTestClient:
        """Spawn a test client for the task runner app.

        :return: the test client
        """
        ...


@pytest.fixture
def spawn_task_runner_client(
    aiohttp_client,
    memory_storage,
    pg: AsyncEngine,
    pg_connection_string: str,
    mocker,
) -> TaskRunnerClientSpawner:
    """A factory method for creating an aiohttp client backed by the task runner app."""

    async def func():
        mocker.patch("virtool.startup.connect_pg", return_value=pg)
        mocker.patch(
            "virtool.startup.create_storage_backend",
            return_value=memory_storage,
        )

        app = await virtool.tasks.main.create_app(
            TaskRunnerConfig(
                base_url="",
                host="localhost",
                no_revision_check=True,
                port=9950,
                postgres_connection_string=pg_connection_string,
                sentry_dsn="",
                storage_backend="s3",
                storage_s3_bucket="test-bucket",
            ),
        )

        return await aiohttp_client(app, auto_decompress=False)

    return func
