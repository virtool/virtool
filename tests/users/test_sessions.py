from datetime import datetime
from math import isclose

import arrow
import pytest
from syrupy.matchers import path_type

from virtool.api.custom_json import loads
from virtool.utils import hash_key


@pytest.fixture
def ip():
    return "1.1.1.1"


@pytest.fixture
def session_id():
    return "session_id_foo"


@pytest.mark.parametrize(
    "use_user_id, remember", [(False, False), (True, False), (True, True)]
)
async def test_create_session(
    mocker,
    snapshot,
    redis,
    data_layer,
    use_user_id,
    remember,
    session_id,
    fake2,
    ip,
):
    start_time = arrow.utcnow()

    mocker.patch(
        "virtool.users.sessions.SessionData.create_session_id",
        return_value=session_id,
    )
    mocker.patch(
        "virtool.utils.generate_key", return_value=("test_token", "test_hashed")
    )

    user_id = None
    if use_user_id:
        user = await fake2.users.create()
        user_id = user.id

    await data_layer.sessions.create(ip, user_id, remember)
    assert loads(await redis.get(session_id)) == snapshot(
        matcher=path_type({"created_at": (str,)})
    )

    time_elapsed = (arrow.utcnow() - start_time).total_seconds()

    if use_user_id and remember:
        starting_ttl = 2592000
    elif use_user_id:
        starting_ttl = 3600
    else:
        starting_ttl = 600

    expected_ttl = starting_ttl - time_elapsed

    assert isclose(await redis.ttl(session_id), expected_ttl, abs_tol=1)


@pytest.mark.parametrize(
    "use_valid_session, authenticated",
    [(False, False), (True, False), (True, True)],
)
async def test_get_session(
    data_layer, use_valid_session, ip, fake2, authenticated, snapshot, mocker
):
    token = "token"
    mocker.patch("virtool.utils.generate_key", return_value=(token, hash_key(token)))

    session_id = "invalid_session"
    if use_valid_session:
        user = await fake2.users.create()
        session_id, _, _ = await data_layer.sessions.create(
            ip, user.id if authenticated else None
        )

    assert (await data_layer.sessions.get(session_id, token))[0] == snapshot(
        matcher=path_type({"created_at": (datetime,)})
    )

    if authenticated:
        assert (
            await data_layer.sessions.get(session_id, "invalid_token")
        ) == snapshot()


@pytest.mark.parametrize("remember", [False, True])
async def test_create_reset_code(
    mocker,
    snapshot,
    redis,
    data_layer,
    session_id,
    remember,
    ip,
):
    start_time = arrow.utcnow()

    reset_code = "reset_code"
    mocker.patch("virtool.users.sessions.secrets.token_hex", return_value=reset_code)

    session_id, _, _ = await data_layer.sessions.create(ip)

    returned_reset_code = await data_layer.sessions.create_reset_code(
        session_id, "user_id", remember
    )

    assert reset_code == returned_reset_code

    assert loads(await redis.get(session_id)) == snapshot(
        matcher=path_type({"created_at": (str,)})
    )

    ttl = await redis.ttl(session_id)
    expected_ttl = 600 - (arrow.utcnow() - start_time).total_seconds()
    assert isclose(ttl, expected_ttl, abs_tol=1)


async def test_clear_reset_code(
    mocker,
    snapshot,
    redis,
    data_layer,
    session_id,
    ip,
):
    start_time = arrow.utcnow()

    reset_code = "reset_code"
    mocker.patch("virtool.users.sessions.secrets.token_hex", return_value=reset_code)

    session_id, _, _ = await data_layer.sessions.create(ip)

    await data_layer.sessions.create_reset_code(session_id, "user_id", False)

    assert loads(await redis.get(session_id)) == snapshot(
        matcher=path_type({"created_at": (str,)})
    )

    await data_layer.sessions.clear_reset_code(session_id)

    assert loads(await redis.get(session_id)) == snapshot(
        matcher=path_type({"created_at": (str,)})
    )

    ttl = await redis.ttl(session_id)
    expected_ttl = 600 - (arrow.utcnow() - start_time).total_seconds()
    assert isclose(ttl, expected_ttl, abs_tol=1)


async def test_get_reset_data(
    mocker,
    snapshot,
    redis,
    data_layer,
    session_id,
    ip,
):

    reset_code = "reset_code"
    mocker.patch("virtool.users.sessions.secrets.token_hex", return_value=reset_code)

    session_id, _, _ = await data_layer.sessions.create(ip)

    reset_code = await data_layer.sessions.create_reset_code(
        session_id, "user_id", False
    )

    assert await data_layer.sessions.get_reset_data(session_id, reset_code) == snapshot
