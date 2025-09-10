import asyncio
from datetime import datetime, timedelta

import arrow
import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from syrupy.matchers import path_type

from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.fake.next import DataFaker
from virtool.sessions.models import SQLSession


async def test_expired_session_cleanup(data_layer, fake: DataFaker, pg):
    """Test that expired sessions are automatically deleted when accessed."""
    user = await fake.users.create()

    # Create sessions
    session_anon = await data_layer.sessions.create_anonymous("1.1.1.1")
    session_auth, token = await data_layer.sessions.create_authenticated(
        "2.2.2.2", user.id, remember=False
    )
    session_reset, code = await data_layer.sessions.create_reset(
        "3.3.3.3", user.id, remember=False
    )

    # Set expiration times to the past using SQLAlchemy
    past_time = arrow.utcnow().naive - timedelta(minutes=1)
    async with AsyncSession(pg) as session:
        await session.execute(
            update(SQLSession)
            .where(
                SQLSession.session_id.in_(
                    [session_anon.id, session_auth.id, session_reset.id]
                )
            )
            .values(expires_at=past_time)
        )
        await session.commit()

    # Try to access expired sessions - should raise ResourceNotFoundError
    with pytest.raises(ResourceNotFoundError):
        await data_layer.sessions.get_anonymous(session_anon.id)

    with pytest.raises(ResourceNotFoundError):
        await data_layer.sessions.get_authenticated(session_auth.id, token)

    with pytest.raises(ResourceNotFoundError):
        await data_layer.sessions.get_reset(session_reset.id, code)

    # Verify sessions were deleted from database
    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLSession).where(
                SQLSession.session_id.in_(
                    [session_anon.id, session_auth.id, session_reset.id]
                )
            )
        )
        remaining_sessions = result.fetchall()
        assert len(remaining_sessions) == 0


async def test_session_cleanup_task(data_layer, fake: DataFaker, pg):
    """Test the session cleanup task removes expired sessions."""
    user = await fake.users.create()

    # Create some sessions
    active_session = await data_layer.sessions.create_anonymous("1.1.1.1")
    expired_session1 = await data_layer.sessions.create_anonymous("2.2.2.2")
    expired_session2, _ = await data_layer.sessions.create_authenticated(
        "3.3.3.3", user.id, remember=False
    )

    # Set some sessions to be expired using SQLAlchemy
    past_time = arrow.utcnow().naive - timedelta(minutes=1)
    async with AsyncSession(pg) as session:
        await session.execute(
            update(SQLSession)
            .where(
                SQLSession.session_id.in_([expired_session1.id, expired_session2.id])
            )
            .values(expires_at=past_time)
        )
        await session.commit()

    # Run cleanup
    deleted_count = await data_layer.sessions.cleanup()
    assert deleted_count == 2

    # Verify only active session remains
    async with AsyncSession(pg) as session:
        result = await session.execute(select(SQLSession.session_id))
        remaining_ids = [row[0] for row in result.fetchall()]
        assert remaining_ids == [active_session.id]


async def test_concurrent_session_reads(data_layer, fake: DataFaker):
    """Test that multiple concurrent reads of the same session work correctly."""
    user = await fake.users.create()
    session, token = await data_layer.sessions.create_authenticated(
        "1.1.1.1", user.id, remember=False
    )

    # Read the same session concurrently 10 times
    results = await asyncio.gather(
        *[data_layer.sessions.get_authenticated(session.id, token) for _ in range(10)]
    )

    # All reads should succeed and return the same session data
    assert len(results) == 10
    assert all(r.id == session.id for r in results)
    assert all(r.authentication.user_id == user.id for r in results)


async def test_concurrent_session_creation(data_layer, fake: DataFaker):
    """Test that multiple sessions can be created concurrently."""
    user = await fake.users.create()

    # Create 10 sessions concurrently
    results = await asyncio.gather(
        *[
            data_layer.sessions.create_authenticated(
                f"1.1.1.{i}", user.id, remember=False
            )
            for i in range(10)
        ]
    )

    # All sessions should be created with unique IDs
    session_ids = [session.id for session, _ in results]
    assert len(session_ids) == 10
    assert len(set(session_ids)) == 10  # All unique


async def test_concurrent_deletion_and_access(data_layer, fake: DataFaker):
    """Test race condition between deletion and access."""
    user = await fake.users.create()
    session, token = await data_layer.sessions.create_authenticated(
        "1.1.1.1", user.id, remember=False
    )

    # Attempt to delete and access concurrently
    delete_task = data_layer.sessions.delete(session.id)
    access_task = data_layer.sessions.get_authenticated(session.id, token)

    results = await asyncio.gather(delete_task, access_task, return_exceptions=True)

    # Either the access succeeds (ran first) or raises ResourceNotFoundError (delete ran first)
    # Both are valid outcomes
    assert len(results) == 2
    if isinstance(results[1], ResourceNotFoundError):
        # Delete ran first
        assert results[0] is None
    else:
        # Access ran first and succeeded
        assert results[1].id == session.id


class TestCheckSessionIsAuthenticated:
    async def test_ok(self, data_layer, fake: DataFaker):
        """Test that check returns True for valid authenticated session."""
        user = await fake.users.create()
        session, _ = await data_layer.sessions.create_authenticated(
            "1.1.1.1", user.id, remember=False
        )

        assert (
            await data_layer.sessions.check_session_is_authenticated(session.id) is True
        )

    async def test_expired_session(self, data_layer, fake: DataFaker, pg):
        """Test that check returns False for expired authenticated session."""
        user = await fake.users.create()
        session, _ = await data_layer.sessions.create_authenticated(
            "1.1.1.1", user.id, remember=False
        )

        # Expire the session
        past_time = arrow.utcnow().naive - timedelta(minutes=1)
        async with AsyncSession(pg) as db_session:
            await db_session.execute(
                update(SQLSession)
                .where(SQLSession.session_id == session.id)
                .values(expires_at=past_time)
            )
            await db_session.commit()

        assert (
            await data_layer.sessions.check_session_is_authenticated(session.id)
            is False
        )

    async def test_nonexistent_session(self, data_layer):
        """Test that check returns False for non-existent session."""
        assert (
            await data_layer.sessions.check_session_is_authenticated("invalid_session")
            is False
        )

    async def test_anonymous_session(self, data_layer):
        """Test that check returns False for anonymous session."""
        session = await data_layer.sessions.create_anonymous("1.1.1.1")

        assert (
            await data_layer.sessions.check_session_is_authenticated(session.id)
            is False
        )

    async def test_reset_session(self, data_layer, fake: DataFaker):
        """Test that check returns False for reset session."""
        user = await fake.users.create()
        session, _ = await data_layer.sessions.create_reset(
            "1.1.1.1", user.id, remember=False
        )

        assert (
            await data_layer.sessions.check_session_is_authenticated(session.id)
            is False
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

    async def test_remember_true_expiration(self, data_layer, fake: DataFaker, pg):
        """Test that authenticated session with remember=True has 30-day expiration."""
        user = await fake.users.create()
        session, _ = await data_layer.sessions.create_authenticated(
            "1.1.1.1", user.id, remember=True
        )

        # Check expiration time is approximately 30 days
        async with AsyncSession(pg) as db_session:
            result = await db_session.execute(
                select(SQLSession).where(SQLSession.session_id == session.id)
            )
            sql_session = result.scalar()
            time_diff = sql_session.expires_at - sql_session.created_at
            # Allow 1 second tolerance for test execution time
            assert (
                timedelta(days=30) - timedelta(seconds=1)
                <= time_diff
                <= timedelta(days=30) + timedelta(seconds=1)
            )

    async def test_remember_false_expiration(self, data_layer, fake: DataFaker, pg):
        """Test that authenticated session with remember=False has 60-minute expiration."""
        user = await fake.users.create()
        session, _ = await data_layer.sessions.create_authenticated(
            "1.1.1.1", user.id, remember=False
        )

        # Check expiration time is approximately 60 minutes
        async with AsyncSession(pg) as db_session:
            result = await db_session.execute(
                select(SQLSession).where(SQLSession.session_id == session.id)
            )
            sql_session = result.scalar()
            time_diff = sql_session.expires_at - sql_session.created_at
            # Allow 1 second tolerance for test execution time
            assert (
                timedelta(minutes=60) - timedelta(seconds=1)
                <= time_diff
                <= timedelta(minutes=60) + timedelta(seconds=1)
            )


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

    async def test_remember_flag_true(self, data_layer, fake: DataFaker, pg):
        """Test that reset session stores remember=True correctly."""
        user = await fake.users.create()
        session, _ = await data_layer.sessions.create_reset(
            "1.1.1.1", user.id, remember=True
        )

        async with AsyncSession(pg) as db_session:
            result = await db_session.execute(
                select(SQLSession).where(SQLSession.session_id == session.id)
            )
            sql_session = result.scalar()
            assert sql_session.reset_remember is True

        # Verify the session model also has it
        assert session.reset.remember is True

    async def test_remember_flag_false(self, data_layer, fake: DataFaker, pg):
        """Test that reset session stores remember=False correctly."""
        user = await fake.users.create()
        session, _ = await data_layer.sessions.create_reset(
            "1.1.1.1", user.id, remember=False
        )

        async with AsyncSession(pg) as db_session:
            result = await db_session.execute(
                select(SQLSession).where(SQLSession.session_id == session.id)
            )
            sql_session = result.scalar()
            assert sql_session.reset_remember is False

        # Verify the session model also has it
        assert session.reset.remember is False


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
