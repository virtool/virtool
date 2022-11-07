import secrets
from datetime import timedelta
from typing import Tuple

from aioredis import Redis
from virtool_core.models.session import (
    Session,
    SessionAuthentication,
    SessionPasswordReset,
)

import virtool.utils
from virtool.api.custom_json import dump_string
from virtool.api.custom_json import isoformat_to_datetime, loads
from virtool.data.errors import ResourceError, ResourceNotFoundError
from virtool.data.piece import DataLayerPiece
from virtool.utils import hash_key


class SessionData(DataLayerPiece):
    def __init__(self, redis: Redis):
        self.redis = redis

    async def create(
        self,
        ip: str,
        user_id: str,
        remember: bool = False,
    ) -> Tuple[str, Session, str]:
        """
        Creates a new session with the given ip and user_id

        :param ip: the ip address of the client
        :param user_id: the user id of the client
        :param remember: Boolean indicating if a session should be saved long term
        :return: the session id, the session model, and the session token
        """
        session_id = await self.create_session_id()

        if remember:
            expires_after = timedelta(days=30).total_seconds()
        else:
            expires_after = timedelta(minutes=60).total_seconds()

        new_session = Session(created_at=virtool.utils.timestamp(), ip=ip)

        token, hashed = virtool.utils.generate_key()
        new_session.authentication = SessionAuthentication(
            token=hashed, user_id=user_id
        )

        await self.redis.set(
            session_id, dump_string(new_session), expire=int(expires_after)
        )

        return session_id, new_session, token

    async def create_anonymous(
        self,
        ip: str,
    ) -> Tuple[str, Session]:
        """
        Creates a new session with the given ip and user_id

        :param ip: the ip address of the client
        :return: the session id, the session model, and the session token
        """
        session_id = await self.create_session_id()

        new_session = Session(created_at=virtool.utils.timestamp(), ip=ip)

        await self.redis.set(session_id, dump_string(new_session), expire=600)

        return session_id, new_session

    async def create_reset_session(self, ip, user_id, remember) -> Tuple[str, Session]:

        reset_code = secrets.token_hex(32)
        session_id = await self.create_session_id()

        session = Session(
            created_at=virtool.utils.timestamp(),
            ip=ip,
            reset=SessionPasswordReset(
                code=reset_code,
                remember=remember,
                user_id=user_id,
            ),
        )

        await self.redis.set(session_id, dump_string(session), expire=600)

        return session_id, session

    async def create_session_id(self) -> str:
        """
        Create a new unique session id.

        :return: a session id

        """
        session_id = "session_" + secrets.token_hex(32)

        if await self.redis.get(session_id):
            return await self.create_session_id()

        return session_id

    async def _get(self, session_id: str) -> Session:
        """
        Get a session provided with only the session id
        NB: Permits access to all sessions using only session id.

        :param session_id: the session id
        :return: the session object and token
        """
        session = await self.redis.get(session_id)

        if session is None:
            raise ResourceNotFoundError("Session is invalid")

        session = loads(session)
        return Session(
            **{
                **session,
                "created_at": isoformat_to_datetime(session["created_at"]),
            }
        )

    async def get_authenticated(self, session_id: str, session_token: str) -> Session:
        """
        Get an authenticated session and token by its id and token.

        :param session_id: the session id
        :param session_token: the secure token for an authenticated session
        :return: the session object and token
        """

        session = await self._get(session_id)

        if session.authentication is None:
            raise ResourceError("Session not authenticated")

        if session.authentication.token == hash_key(session_token):
            return session

        raise ResourceError("Session not authenticated")

    async def get_anonymous(self, session_id: str) -> Session:
        """
        Gets an anonymous session by its id.

        :param session_id: the session id
        :return: the session object
        """

        session = await self._get(session_id)

        if session.authentication is not None:
            raise ResourceError("Invalid session")

        return session

    async def delete(self, session_id) -> None:
        """
        Deletes the session matching the provided id

        :param session_id: the id of the session to remove
        """
        await self.redis.delete(session_id)

    async def clear_reset_session(self, session_id: str) -> str:
        """
        Clear the reset information attached to the session associated with the passed
        `session_id`.

        :param session_id: the session id
        """

        session = await self._get(session_id)

        if session.reset is None:
            return session_id

        await self.delete(session_id)
        session_id, _ = await self.create_anonymous(session.ip)

        return session_id

    async def get_reset_data(self, session_id: str) -> SessionPasswordReset:
        """
        Gets any reset data associated with the passed session if the passed reset code
        matches the stored reset code.

        :param session_id: the session id
        :return: the associated user_id and remember boolean
        """
        session = await self.get_anonymous(session_id)

        return session.reset
