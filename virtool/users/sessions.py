"""
The sessions data layer is used for managing and querying sessions.

Sessions are immutable, meaning they can be created and destroyed but not modified. For
example, if a user logs in, a new authenticated session should be created and the old
anonymous session should be deleted.

Sessions have unique IDs that are stored in the browser as the ``session_id`` cookie.

There are three session types:

1. Anonymous sessions

   These sessions are used when the client is not authenticated (anonymous) and they
   should only be used to access public resources.

2. Password reset sessions

   These sessions are used when a user requests a password reset. They should grant 
   access to protected resources.

   These sessions have a short lifetime and are deleted if the client resets their
   password or makes a request to any other endpoint before resetting their password.

3. Authenticated sessions

   Authenticated sessions are created when a client logs in successfully.
   
   Prior to login, a client will have an anonymous session. After login, the session
   will be replaced with a new authenticated session that has a unique `session_token`
   that identifies it as being authenticated.
   
   Authenticated sessions can be returned from the data layer if both the ``session_id``
   and ``session_token`` match a valid session.

When creating a new session authenticated sessions and anonymous sessions should be
treated as separate resources. For example, if a client makes a request to get a session
via the anonymous session API and the passed ``session_id`` is associated with an
authenticated session, the data layer should raise a generic
:exception:``ResourceNotFound`` error.

"""

import secrets
from datetime import timedelta
from typing import Tuple
from aioredis import Redis
from virtool_core.models.session import (
    Session,
)

import virtool.utils
from virtool.api.custom_json import dump_string
from virtool.api.custom_json import isoformat_to_datetime, loads
from virtool.data.errors import (
    ResourceNotFoundError,
)
from virtool.data.piece import DataLayerPiece
from virtool.utils import get_safely, hash_key


class SessionData(DataLayerPiece):
    """
    The data layer piece for user sessions.

    It is responsible for creating, querying, and deleting user sessions.
    """

    def __init__(self, redis: Redis):
        self.redis = redis

    async def create_anonymous(
        self,
        ip: str,
    ) -> Session:
        """
        Creates an anonymous session with the given ``ip`` and ``user_id``.

        :param ip: the ip address of the client
        :return: the session id, the session model, and the session token
        """
        session_id = await self._create_session_id()

        session = Session(created_at=virtool.utils.timestamp(), ip=ip, id=session_id)

        await self.redis.set(session_id, dump_string(session), expire=600)

        return session

    async def create_authenticated(
        self,
        ip: str,
        user_id: str,
        remember: bool = False,
    ) -> Tuple[Session, str]:
        """
        Creates a new authenticated session with the given ``ip`` and ``user_id``.

        When an authenticated session is created, the anonymous session used to make the
        login request should be deleted with :meth:`delete`.

        :param ip: the ip address of the client
        :param user_id: the user id of the client
        :param remember: whether the session should be saved long term
        :return: the session id, the session model, and the session token
        """
        session_id = await self._create_session_id()

        if remember:
            expires_after = timedelta(days=30).total_seconds()
        else:
            expires_after = timedelta(minutes=60).total_seconds()

        token, hashed = virtool.utils.generate_key()

        session = {
            "authentication": {"user_id": user_id, "token": hashed},
            "created_at": virtool.utils.timestamp(),
            "id": session_id,
            "ip": ip,
        }

        await self.redis.set(
            session_id,
            dump_string(session),
            expire=int(expires_after),
        )

        return Session(**session), token

    async def create_reset(
        self, ip: str, user_id: str, remember: bool
    ) -> Tuple[Session, str]:
        """
        Creates a new reset session.

        :param ip: the ip address of the client
        :param user_id: the user id of the client
        :param remember: whether the session should be saved long term
        :return: the session id, the session model, and the session token
        """
        reset_code = secrets.token_hex(32)
        session_id = await self._create_session_id()

        session = {
            "created_at": virtool.utils.timestamp(),
            "id": session_id,
            "ip": ip,
            "reset": {
                "code": reset_code,
                "remember": remember,
                "user_id": user_id,
            },
        }

        await self.redis.set(
            session_id,
            dump_string(session),
            expire=600,
        )

        return Session(**session), reset_code

    async def get_authenticated(self, session_id: str, session_token: str) -> Session:
        """
        Get an authenticated session by its ``session_id`` and ``session_token``.

        :param session_id: the session id
        :param session_token: the secure token for an authenticated session
        :raises ResourceNotFoundError: if the session is not found or not authenticated
        :return: the session object and token
        """

        session = await self._get(session_id)

        if not session.get("authentication") or session.get("reset"):
            raise ResourceNotFoundError("Session not found")

        if session["authentication"]["token"] != hash_key(session_token):
            raise ResourceNotFoundError("Invalid session token")

        return Session(**session)

    async def get_anonymous(self, session_id: str) -> Session:
        """
        Gets an anonymous session with the passed ``session_id``.

        :param session_id: the session id
        :raises ResourceNotFoundError: if the session is not found or is not anonymous
        :return: the session object
        """
        session = await self._get(session_id)

        if session.get("authentication") or session.get("reset"):
            raise ResourceNotFoundError("Session not found")

        return Session(**session)

    async def get_reset(self, session_id: str, reset_code: str) -> Session:
        """
        Gets a session with a pending password reset given its ``session_id`` and its
        valid ``reset_code``.

        If the passed ``reset_code`` is not valid for the session with the passed
        ``session_id``, :exception:``ResourceNotFound` will be raised.

        :param session_id: the session id
        :param reset_code: the reset code fopr
        :raises:
        :return: the associated user_id and remember boolean
        """
        session = await self._get(session_id)

        stored_reset_code: str = get_safely(session, "reset", "code")

        if (
            not reset_code
            or session.get("authentication")
            or stored_reset_code != reset_code
        ):
            raise ResourceNotFoundError("Session not found")

        if stored_reset_code != reset_code:
            raise ResourceNotFoundError("Invalid reset code")

        return Session(**session)

    async def delete(self, session_id: str):
        """
        Deletes the session with the provided ``session_id``.

        :param session_id: the id of the session to remove
        """
        await self.redis.delete(session_id)

    async def _create_session_id(self) -> str:
        """
        Create a unique session id.

        :return: a session id

        """
        session_id = "session_" + secrets.token_hex(32)

        if await self.redis.get(session_id):
            return await self._create_session_id()

        return session_id

    async def _get(self, session_id: str) -> dict:
        """
        Get a session provided a ``session_id``.

        :param session_id: the session id
        :raises ResourceNotFoundError: if the session does not exist
        :return: the session object and token
        """
        session = await self.redis.get(session_id)

        if session is None:
            raise ResourceNotFoundError("Session is invalid")

        session = loads(session)

        return {
            **session,
            "created_at": isoformat_to_datetime(session["created_at"]),
            "id": session_id,
        }
