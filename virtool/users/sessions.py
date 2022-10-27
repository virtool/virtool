import asyncio
import hashlib
import json
import secrets
from datetime import timedelta
from typing import Optional, Tuple

from aioredis import Redis
from virtool_core.models.session import (
    Session,
    SessionAuthentication,
)

import virtool.utils
from virtool.api.custom_json import dumps, fromisoformat, isoformat
from virtool.data.errors import ResourceError
from virtool.data.piece import DataLayerPiece


class SessionData(DataLayerPiece):
    def __init__(self, redis: Redis):
        self.redis = redis

    async def create(
        self,
        ip: str,
        user_id: Optional[str] = None,
        remember: Optional[bool] = False,
    ) -> Tuple[str, Session, str]:
        """
        Creates a new session with the given ip and user_id

        :param ip: the ip address of the client
        :param user_id: the user id of the client
        :param remember: Boolean indicating if a session should be saved long term
        :return: the session id, the session model, and the session token
        """
        session_id = await self.create_session_id()

        if user_id and remember:
            expires_after = timedelta(days=30).total_seconds()
        elif user_id:
            expires_after = timedelta(minutes=60).total_seconds()
        else:
            expires_after = timedelta(minutes=10).total_seconds()

        new_session = Session(created_at=isoformat(virtool.utils.timestamp()), ip=ip)

        token = None

        if user_id:
            token, hashed = virtool.utils.generate_key()
            new_session.authentication = SessionAuthentication(
                token=hashed, user_id=user_id
            )

        await self.redis.set(session_id, dumps(new_session), expire=int(expires_after))

        return session_id, new_session, token

    async def create_session_id(self) -> str:
        """
        Create a new unique session id.

        :return: a session id

        """
        session_id = "session_" + secrets.token_hex(32)

        while await self.redis.get(session_id):
            session_id = "session_" + secrets.token_hex(32)

        return session_id

    async def get(
        self, session_id: str, session_token: Optional[str] = None
    ) -> Tuple[Optional[Session], Optional[str]]:
        """
        Get a session and token by its id and token.

        If the passed `session_token` is `None`, an unauthenticated session document
        matching the `session_id` will be returned. If the matching session is
        authenticated and token is passed, `None` will be returned.

        Will return `(None, None)` if the session doesn't exist or the session id
        and token do not go together.

        :param session_id: the session id
        :param session_token: the secure token for an authenticated session
        :return: the session object and token
        """

        try:
            dict_session = json.loads(await self.redis.get(session_id))
            session = Session(
                **{
                    **dict_session,
                    "created_at": fromisoformat(dict_session["created_at"]),
                }
            )
        except TypeError:
            return None, None

        if session.authentication is None:
            return session, None

        if session_token is None:
            return None, None

        stored_session_token = session.authentication.token
        hashed_token = hashlib.sha256(session_token.encode()).hexdigest()
        if stored_session_token == hashed_token:
            return session, session_token

        return None, None

    async def replace(
        self,
        session_id: str,
        ip: str,
        user_id: Optional[str] = None,
        remember: Optional[bool] = False,
    ) -> Tuple[str, Session, str]:
        """
        Replace the session associated with `session_id` with a new one. Return the new
        session document.

        Supplying a `user_id` indicates the session is authenticated. Setting `remember`
        will make the session last for 30 days instead of the default 30 minutes.

        :param session_id: the id of the session to replace
        :param ip: the ip address of the client
        :param user_id: the id of the authenticated user who the session belongs to
        :param remember: boolean indicating if a session should be saved long term
        :return: new session id, session object and token
        """
        await self.redis.delete(session_id)
        return await self.create(ip, user_id, remember=remember)

    async def create_reset_code(
        self,
        session_id: str,
        user_id: str,
        remember: Optional[bool] = False,
    ) -> str:
        """
        Create a secret code that is used to verify a password reset request.
        Properties:

        - the reset request must pass a reset code that is associated with the session
          linked to the request
        - the reset code is dropped from the session for any non-reset request sent after
          the code was generated

        :param session_id: the session id
        :param session_token: the token associated with the session_id
        :param user_id: the id of the authenticated user who the session belongs to
        :param remember: boolean indicating if a session should be saved long term
        :return: the reset_code associated with the passed session

        """
        reset_code = secrets.token_hex(32)

        (session, _), session_expiry = await asyncio.gather(
            self.get(session_id), self.redis.ttl(session_id)
        )

        if not session:
            raise ResourceError()

        session.reset = {
            "code": reset_code,
            "remember": remember,
            "user_id": user_id,
        }

        await self.redis.set(session_id, dumps(session), expire=session_expiry)

        return reset_code

    async def clear_reset_code(
        self, session_id: str, session_token: Optional[str] = None
    ) -> None:
        """
        Clear the reset information attached to the session associated with the passed
        `session_id`.

        :param session_id: the session id
        :param session_token: the token associated with the session_id
        """

        (session, _), session_expiry = await asyncio.gather(
            self.get(session_id, session_token), self.redis.ttl(session_id)
        )

        if not session:
            return

        session.reset = None

        await self.redis.set(session_id, dumps(session), expire=session_expiry)

    async def get_reset_data(
        self, session_id: str, reset_code: str
    ) -> Tuple[str, bool]:
        """
        Gets any reset data associated with the passed session if the passed reset code
        matches the stored reset code.

        :param session_id: the session id
        :param reset_code: the reset code associated with the current session
        :return: the associated user_id and remember boolean
        """
        session, _ = await self.get(session_id)

        reset = session.reset

        if not reset or reset_code != reset.code:
            raise ResourceError()

        return reset.user_id, reset.remember
