import asyncio
from datetime import datetime
from math import isclose

import pytest
from syrupy.matchers import path_type

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker


async def test_remember_anonymous(data_layer, redis):
    """Test that anonymous session objects in Redis get a TTL of 600."""
    session = await data_layer.sessions.create_anonymous("1.1.1.1")
    assert isclose(await redis.ttl(session.id), 600, abs_tol=10)


@pytest.mark.parametrize("remember", [False, True])
async def test_remember_authenticated(
    data_layer,
    fake: DataFaker,
    redis,
    remember,
):
    """Test that the session object gets the correct TTL in Redis based on whether
    ``remember`` is set.
    """
    user = await fake.users.create()

    session, _ = await data_layer.sessions.create_authenticated(
        "1.1.1.1",
        user.id,
        remember=remember,
    )

    assert isclose(
        await redis.ttl(session.id),
        2592000 if remember else 3600,
        abs_tol=10,
    )


class TestAuthenticated:
    async def test_get_and_create(
        self,
        data_layer: DataLayer,
        fake: DataFaker,
        snapshot,
    ):
        """Test that an authenticated session can be created and then retrieved."""
        user = await fake.users.create()

        session, token = await data_layer.sessions.create_authenticated(
            "1.1.1.1",
            user.id,
            False,
        )

        assert (
            await data_layer.sessions.get_authenticated(session.id, token)
        ) == snapshot(
            name="snapshot",
            matcher=path_type({"id": (str,), "created_at": (datetime,)}),
        )

    async def test_invalid_token(
        self, data_layer: DataLayer, fake: DataFaker, snapshot
    ):
        """Test that a ``ResourceNotFound`` error is raised when the token is invalid."""
        user = await fake.users.create()

        session, _ = await data_layer.sessions.create_authenticated(
            "1.1.1.1",
            user.id,
            False,
        )

        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_authenticated(session.id, "invalid_token")
            assert str(err) == "Invalid session token"

    async def test_invalid_session(self, data_layer):
        """Test that ``ResourceNotFound`` is raised when the session ID does not exist."""
        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_authenticated("invalid_session", "token")
            assert str(err) == "Session not found"

    async def test_anonymous_session(self, data_layer, snapshot):
        """Test that an anonymous session cannot be retrieved using get_authenticated."""
        session = await data_layer.sessions.create_anonymous("1.1.1.1")

        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_authenticated(session.id, "invalid_token")
            assert str(err) == "Session not found"

    async def test_reset_session(self, data_layer, fake: DataFaker, snapshot):
        """Test that a reset session cannot be retrieved using get_authenticated."""
        user = await fake.users.create()

        session, code = await data_layer.sessions.create_reset(
            "1.1.1.1",
            user.id,
            False,
        )

        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_authenticated(session.id, code)
            assert str(err) == "Session not found"


class TestAnonymous:
    async def test_get_and_create(
        self,
        data_layer,
        snapshot,
    ):
        """Test that the method works for a true anonymous session."""
        session = await data_layer.sessions.create_anonymous("1.1.1.1")

        assert (await data_layer.sessions.get_anonymous(session.id)) == snapshot(
            matcher=path_type({"id": (str,), "created_at": (datetime,)}),
        )

    async def test_no_session(self, data_layer):
        """Test that ``ResourceNotFound`` is raised when the session ID does not exist."""
        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_anonymous("invalid_session")
            assert str(err) == "Session not found"

    async def test_authenticated_session(self, data_layer, fake: DataFaker, snapshot):
        """Test that an exception is raised when we attempt to get a session that is
        actually authenticated instead of anonymous.
        """
        user = await fake.users.create()

        session, _ = await data_layer.sessions.create_authenticated(
            "1.1.1.1",
            user.id,
            False,
        )

        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_anonymous(session.id)
            assert str(err) == "Session not found"

    async def test_reset_session(self, data_layer, fake: DataFaker, snapshot):
        """Test that an exception is raised when and we attempt to get a session that is
        actually a reset session instead of an anonymous one.
        """
        user = await fake.users.create()

        session, _ = await data_layer.sessions.create_reset("1.1.1.1", user.id, False)

        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_anonymous(session.id)
            assert str(err) == "Session not found"


class TestReset:
    async def test_create_and_get(
        self,
        data_layer,
        fake: DataFaker,
        redis,
        snapshot,
    ):
        """Test that a reset session can be created and retrieved using its ID and reset
        code.
        """
        user = await fake.users.create()

        created_session, reset_code = await data_layer.sessions.create_reset(
            "1.1.1.1",
            user.id,
            remember=True,
        )

        session = await data_layer.sessions.get_reset(created_session.id, reset_code)

        assert session == snapshot(
            matcher=path_type({"id": (str,), "created_at": (datetime,)}),
        )

        assert session.id == created_session.id

    async def test_no_session(self, data_layer, fake):
        """Test that ``ResourceNotFound`` is raised when the session doesn't exist."""
        user = await fake.users.create()

        session, reset_code = await data_layer.sessions.create_reset(
            "1.1.1.1",
            user.id,
            remember=True,
        )

        await data_layer.sessions.delete(session.id)

        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_reset(session.id, reset_code)
            assert str(err) == "Session not found"

    async def test_invalid_reset_code(self, data_layer, fake):
        """Test that ``ResourceNotFound`` is raised when the provided reset code is invalid
        for the session.
        """
        user = await fake.users.create()

        session, _ = await data_layer.sessions.create_reset(
            "1.1.1.1",
            user.id,
            remember=True,
        )

        with pytest.raises(ResourceNotFoundError) as err:
            await data_layer.sessions.get_reset(session.id, "invalid_code")
            assert str(err) == "Invalid reset code"


async def test_delete(
    data_layer: DataLayer,
    fake: DataFaker,
    snapshot,
):
    """Test that all types of sessions can be deleted by their IDs."""
    user = await fake.users.create()

    session_anonymous = await data_layer.sessions.create_anonymous("1.1.1.1")
    session_authenticated, token = await data_layer.sessions.create_authenticated(
        "2.2.2.2",
        user.id,
        remember=True,
    )
    session_reset, reset_code = await data_layer.sessions.create_reset(
        "3.3.3.3",
        user.id,
        remember=True,
    )

    # Make sure get method don't raise ``ResourceNotFound``.
    assert all(
        await asyncio.gather(
            data_layer.sessions.get_anonymous(session_anonymous.id),
            data_layer.sessions.get_authenticated(session_authenticated.id, token),
            data_layer.sessions.get_reset(session_reset.id, reset_code),
        ),
    )

    await asyncio.gather(
        data_layer.sessions.delete(session_anonymous.id),
        data_layer.sessions.delete(session_authenticated.id),
        data_layer.sessions.delete(session_reset.id),
    )

    # Now, make sure get methods do raise ``ResourceNotFound``.
    with pytest.raises(ResourceNotFoundError):
        await data_layer.sessions.get_anonymous(session_anonymous.id)

    with pytest.raises(ResourceNotFoundError):
        await data_layer.sessions.get_authenticated(session_authenticated.id, token)

    with pytest.raises(ResourceNotFoundError):
        await data_layer.sessions.get_reset(session_reset.id, reset_code)
