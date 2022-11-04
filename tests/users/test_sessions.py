from datetime import datetime
from math import isclose

import arrow
import pytest
from syrupy.matchers import path_type

from virtool.api.custom_json import loads
from virtool.data.errors import ResourceError, ResourceNotFoundError
from virtool.utils import hash_key


@pytest.fixture
def ip():
    return "1.1.1.1"


@pytest.fixture
def session_id():
    return "session_id"


@pytest.fixture
def session_manager(mocker, data_layer, session_id, redis):
    mocker.patch(
        "virtool.users.sessions.SessionData.create_session_id",
        return_value=session_id,
    )

    token = "token"
    mocker.patch("virtool.utils.generate_key", return_value=(token, hash_key(token)))

    reset_code = "reset_code"
    mocker.patch("virtool.users.sessions.secrets.token_hex", return_value=reset_code)

    class SessionManager:
        def __init__(self):
            self.start_time = None

        async def create(self, ip, user_id=None, remember=False, reset=False):
            if self.start_time is None:
                self.start_time = arrow.utcnow()
            if reset:
                return await data_layer.sessions.create_reset_session(
                    ip, user_id, remember
                )

            if user_id:
                return await data_layer.sessions.create(ip, user_id, remember)

            return await data_layer.sessions.create_anonymous(ip)

        async def test_ttl(self, starting_ttl, session_id=session_id):
            time_elapsed = (arrow.utcnow() - self.start_time).total_seconds()
            expected_ttl = starting_ttl - time_elapsed
            assert isclose(await redis.ttl(session_id), expected_ttl, abs_tol=1)

    return SessionManager()


@pytest.mark.parametrize("remember", [False, True])
async def test_create_session(
    snapshot,
    redis,
    data_layer,
    remember,
    session_id,
    fake2,
    ip,
    session_manager,
):

    user = await fake2.users.create()

    await session_manager.create(ip, user.id, remember=remember)

    assert loads(await redis.get(session_id)) == snapshot(
        matcher=path_type({"created_at": (str,)})
    )

    if remember:
        starting_ttl = 2592000
    else:
        starting_ttl = 3600

    await session_manager.test_ttl(starting_ttl)


async def test_create_anonymous_session(
    snapshot,
    redis,
    data_layer,
    session_id,
    ip,
    session_manager,
):

    await session_manager.create(ip)

    assert loads(await redis.get(session_id)) == snapshot(
        matcher=path_type({"created_at": (str,)})
    )

    await session_manager.test_ttl(600)


async def test_create_reset_session(
    snapshot,
    redis,
    data_layer,
    session_id,
    fake2,
    ip,
    session_manager,
):
    user = await fake2.users.create()

    await session_manager.create(ip, user_id=user.id, reset=True)

    assert loads(await redis.get(session_id)) == snapshot(
        matcher=path_type({"created_at": (str,)})
    )

    await session_manager.test_ttl(600)


async def test_get_authenticated(
    data_layer,
    ip,
    fake2,
    snapshot,
    session_manager,
):

    user = await fake2.users.create()
    session_id, _, token = await session_manager.create(ip, user.id)

    assert (await data_layer.sessions.get_authenticated(session_id, token)) == snapshot(
        matcher=path_type({"created_at": (datetime,)})
    )

    try:
        await data_layer.sessions.get_authenticated(session_id, "invalid_token")
    except ResourceError as err:
        assert err == snapshot()


async def test_get_anonymous(
    data_layer,
    ip,
    snapshot,
    session_manager,
):

    session_id, _ = await session_manager.create(ip)

    assert (await data_layer.sessions.get_anonymous(session_id)) == snapshot(
        matcher=path_type({"created_at": (datetime,)})
    )

    try:
        await data_layer.sessions.get_anonymous("invalid_session")
    except ResourceNotFoundError as err:
        assert err == snapshot()


async def test_delete(
    data_layer,
    ip,
    snapshot,
    session_manager,
):

    session_id, _ = await session_manager.create(ip)

    # Check that the session exists
    assert (await data_layer.sessions.get_anonymous(session_id)) == snapshot(
        matcher=path_type({"created_at": (datetime,)})
    )

    await data_layer.sessions.delete(session_id)

    # Check that the session has been removed
    try:
        await data_layer.sessions.get_anonymous(session_id)
    except ResourceNotFoundError as err:
        assert err == snapshot()


@pytest.mark.parametrize("reset", [False, True])
async def test_clear_reset_session(
    data_layer, ip, fake2, snapshot, session_manager, reset, mocker
):
    user = await fake2.users.create()
    result = await session_manager.create(ip, user.id, reset=reset)

    assert await data_layer.sessions._get(result[0]) == snapshot(
        matcher=path_type({"created_at": (datetime,)})
    )
    mocker.patch(
        "virtool.users.sessions.SessionData.create_session_id",
        return_value="new_session_id",
    )
    new_session_id = await data_layer.sessions.clear_reset_session(result[0])

    assert (await data_layer.sessions._get(new_session_id)) == snapshot(
        matcher=path_type({"created_at": (datetime,)})
    )

    if reset:
        try:
            await data_layer.sessions._get(result[0])
            assert 0
        except ResourceNotFoundError as err:
            assert err == snapshot()

    if reset:
        expected_ttl = 600
    else:
        expected_ttl = 3600

    await session_manager.test_ttl(expected_ttl, new_session_id)


async def test_get_reset_data(
    snapshot, redis, data_layer, session_id, ip, session_manager, fake2
):

    user = await fake2.users.create()
    session_id, _ = await session_manager.create(ip, user.id, reset=True)

    assert await data_layer.sessions.get_reset_data(session_id) == snapshot
