"""PostgreSQL-based session data layer.

This replaces the Redis-based session storage with PostgreSQL while maintaining
the same API interface as the original SessionData class.
"""

import secrets
from datetime import timedelta

import arrow
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.utils
from virtool.data.domain import DataLayerDomain
from virtool.data.errors import ResourceNotFoundError
from virtool.models.sessions import Session
from virtool.sessions.models import SessionType, SQLSession
from virtool.utils import hash_key


class SessionData(DataLayerDomain):
    """PostgreSQL-based session data layer.

    Provides the same interface as the Redis-based SessionData but stores
    sessions in PostgreSQL for better consistency and transaction support.
    """

    def __init__(self, pg: AsyncEngine) -> None:
        """Initialize a the sessions data layer domain."""
        self._pg = pg

    async def create_anonymous(self, ip: str) -> Session:
        """Create an anonymous session with the given IP address.

        :param ip: the IP address of the client
        :return: the session model
        """
        session_id = await self._create_session_id()
        created_at = arrow.utcnow().naive
        expires_at = created_at + timedelta(seconds=600)

        sql_session = SQLSession(
            session_id=session_id,
            user_id=None,
            ip=ip,
            created_at=created_at,
            expires_at=expires_at,
            token_hash=None,
            reset_code=None,
            reset_remember=None,
            session_type=SessionType.anonymous,
        )

        async with AsyncSession(self._pg) as session:
            session.add(sql_session)
            await session.commit()

        return await self.get_anonymous(session_id)

    async def create_authenticated(
        self,
        ip: str,
        user_id: str,
        remember: bool,
    ) -> tuple[Session, str]:
        """Create a new authenticated session.

        :param ip: the IP address of the client
        :param user_id: the user ID of the client
        :param remember: whether the session should be saved long term
        :return: tuple of (session model, session token)
        """
        session_id = await self._create_session_id()
        created_at = arrow.utcnow().naive

        if remember:
            expires_at = created_at + timedelta(days=30)
        else:
            expires_at = created_at + timedelta(minutes=60)

        token, hashed = virtool.utils.generate_key()

        sql_session = SQLSession(
            session_id=session_id,
            user_id=int(user_id),
            ip=ip,
            created_at=created_at,
            expires_at=expires_at,
            token_hash=hashed,
            reset_code=None,
            reset_remember=None,
            session_type=SessionType.authenticated,
        )

        async with AsyncSession(self._pg) as session:
            session.add(sql_session)
            await session.commit()

        return await self.get_authenticated(session_id, token), token

    async def create_reset(
        self,
        ip: str,
        user_id: str,
        remember: bool,
    ) -> tuple[Session, str]:
        """Create a new reset session.

        :param ip: the IP address of the client
        :param user_id: the user ID of the client
        :param remember: whether the session should be saved long term
        :return: tuple of (session model, reset code)
        """
        reset_code = secrets.token_hex(32)
        session_id = await self._create_session_id()
        created_at = arrow.utcnow().naive
        expires_at = created_at + timedelta(seconds=600)

        sql_session = SQLSession(
            session_id=session_id,
            user_id=int(user_id),
            ip=ip,
            created_at=created_at,
            expires_at=expires_at,
            token_hash=None,
            reset_code=reset_code,
            reset_remember=remember,
            session_type=SessionType.reset,
        )

        async with AsyncSession(self._pg) as session:
            session.add(sql_session)
            await session.commit()

        return await self.get_reset(session_id, reset_code), reset_code

    async def get_authenticated(self, session_id: str, session_token: str) -> Session:
        """Get an authenticated session by ID and token.

        :param session_id: the session ID
        :param session_token: the secure token for an authenticated session
        :raises ResourceNotFoundError: if the session is not found or not authenticated
        :return: the session object
        """
        sql_session = await self._get_session(session_id)

        if sql_session.session_type != SessionType.authenticated:
            raise ResourceNotFoundError

        if sql_session.session_type == SessionType.reset:
            await self.delete(session_id)
            raise ResourceNotFoundError

        if sql_session.token_hash != hash_key(session_token):
            raise ResourceNotFoundError

        if sql_session.is_expired():
            await self.delete(session_id)
            raise ResourceNotFoundError

        return Session(**sql_session.to_dict())

    async def check_session_is_authenticated(self, session_id: str) -> bool:
        """Check whether a session is authenticated.

        :param session_id: the session ID
        :return: True if the session is authenticated, False otherwise
        """
        try:
            sql_session = await self._get_session(session_id)
            return (
                sql_session.session_type == SessionType.authenticated
                and not sql_session.is_expired()
            )
        except ResourceNotFoundError:
            return False

    async def get_anonymous(self, session_id: str) -> Session:
        """Get an anonymous session with the given session ID.

        :param session_id: the session ID
        :raises ResourceNotFoundError: if the session is not found or is not anonymous
        :return: the session object
        """
        sql_session = await self._get_session(session_id)

        if sql_session.session_type == SessionType.authenticated:
            raise ResourceNotFoundError

        if sql_session.session_type == SessionType.reset:
            await self.delete(session_id)
            raise ResourceNotFoundError

        if sql_session.is_expired():
            await self.delete(session_id)
            raise ResourceNotFoundError

        return Session(**sql_session.to_dict())

    async def get_reset(self, session_id: str, reset_code: str) -> Session:
        """Get a session with a pending password reset.

        :param session_id: the session ID
        :param reset_code: the reset code
        :raises ResourceNotFoundError: if session not found or reset code invalid
        :return: the session object
        """
        sql_session = await self._get_session(session_id)

        if sql_session.session_type == SessionType.authenticated:
            raise ResourceNotFoundError

        if sql_session.session_type != SessionType.reset or not sql_session.reset_code:
            raise ResourceNotFoundError

        if sql_session.reset_code != reset_code:
            await self.delete(session_id)
            raise ResourceNotFoundError

        if sql_session.is_expired():
            await self.delete(session_id)
            raise ResourceNotFoundError

        return Session(**sql_session.to_dict())

    async def delete(self, session_id: str) -> None:
        """Delete the session with the provided session ID.

        :param session_id: the ID of the session to remove
        """
        async with AsyncSession(self._pg) as session:
            await session.execute(
                delete(SQLSession).where(SQLSession.session_id == session_id)
            )
            await session.commit()

    async def delete_by_user(self, user_id: int) -> None:
        """Delete all sessions for a user.

        :param user_id: the user ID whose sessions should be deleted
        """
        async with AsyncSession(self._pg) as session:
            await session.execute(
                delete(SQLSession).where(SQLSession.user_id == user_id)
            )
            await session.commit()

    async def _create_session_id(self) -> str:
        """Create a unique session ID.

        :return: a session ID
        """
        return "session_" + secrets.token_hex(48)

    async def cleanup(self) -> int:
        """Delete all expired sessions from the database.

        :return: number of sessions deleted
        """
        async with AsyncSession(self._pg) as session:
            # Delete sessions where expires_at is in the past
            result = await session.execute(
                delete(SQLSession).where(SQLSession.expires_at < arrow.utcnow().naive)
            )
            deleted_count = result.rowcount or 0
            await session.commit()

        return deleted_count

    async def _get_session(self, session_id: str) -> SQLSession:
        """Get a session by session ID.

        :param session_id: the session ID
        :raises ResourceNotFoundError: if the session does not exist
        :return: the SQLSession object
        """
        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLSession).where(SQLSession.session_id == session_id)
            )
            sql_session = result.scalar()

            if sql_session is None:
                raise ResourceNotFoundError

            return sql_session
