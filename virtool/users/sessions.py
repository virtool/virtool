import asyncio
import hashlib
import json
import secrets
from typing import Optional, Tuple

import arrow
from aioredis import Redis
from motor.motor_asyncio import AsyncIOMotorClientSession

import virtool.utils
from virtool.api.custom_json import CustomEncoder
from virtool.mongo.core import DB
from virtool.types import Document


async def create_session(
    db: DB,
    redis: Redis,
    ip: str,
    user_id: Optional[str] = None,
    remember: Optional[bool] = False,
    session: Optional[AsyncIOMotorClientSession] = None,
) -> Tuple[str, Document, str]:
    session_id = await create_session_id(redis)

    utc = arrow.utcnow()

    if user_id and remember:
        expires_at = utc.shift(days=30)
    elif user_id:
        expires_at = utc.shift(minutes=60)
    else:
        expires_at = utc.shift(minutes=10)

    new_session = {
        "created_at": virtool.utils.timestamp().timestamp(),
        "ip": ip,
    }
    print(new_session)
    token = None

    if user_id:
        token, hashed = virtool.utils.generate_key()
        user_document = await db.users.find_one(user_id, session=session)
        new_session.update(
            {
                "token": hashed,
                "administrator": user_document["administrator"],
                "groups": user_document["groups"],
                "permissions": user_document["permissions"],
                "force_reset": user_document["force_reset"],
                "user": {"id": user_id},
            }
        )

    await redis.set(session_id, json.dumps(new_session, cls=CustomEncoder))
    await redis.expireat(session_id, expires_at.timestamp())

    return session_id, new_session, token


async def create_session_id(redis: Redis) -> str:
    """
    Create a new unique session id.

    :param redis: the application redis client
    :return: a session id

    """
    session_id = "session_" + secrets.token_hex(32)

    if await redis.get(session_id):
        return await create_session_id(redis)

    return session_id


async def get_session(
    redis: Redis, session_id: str, session_token: str
) -> Tuple[Optional[dict], Optional[str]]:
    """
    Get a session and token by its id and token.

    If the passed `session_token` is `None`, an unauthenticated session document
    matching the `session_id` will be returned. If the matching session is authenticated
    and token is passed, `None` will be returned.

    Will return `None` if the session doesn't exist or the session id and token do not
    go together.

    :param redis: the application redis client
    :param session_id: the session id
    :param session_token: the token for the session
    :return: a session document

    """

    unparsed_session = None

    if session_id:
        unparsed_session = await redis.get(session_id)

    if not unparsed_session:
        return None, None

    session = json.loads(unparsed_session)

    try:
        stored_session_token = session["token"]
    except KeyError:
        return session, None

    if session_token is None:
        return None, None

    hashed_token = hashlib.sha256(session_token.encode()).hexdigest()
    if stored_session_token == hashed_token:
        return session, session_token


async def create_reset_code(
    redis: Redis, session_id: str, user_id: str, remember: Optional[bool] = False
) -> str:
    """
    Create a secret code that is used to verify a password reset request. Properties:

    - the reset request must pass a reset code that is associated with the session
      linked to the request
    - the reset code is dropped from the session for any non-reset request sent after
      the code was generated

    :param redis:
    :param session_id:
    :param user_id:
    :param remember:
    :return:

    """
    reset_code = secrets.token_hex(32)

    unparsed_session, session_expiry = await asyncio.gather(
        redis.get(session_id), redis.ttl(session_id)
    )

    session = json.loads(unparsed_session)

    await redis.set(
        session_id,
        json.dumps(
            {
                **session,
                "reset_code": reset_code,
                "reset_remember": remember,
                "reset_user_id": user_id,
            },
            cls=CustomEncoder,
        ),
        expire=session_expiry,
    )

    return reset_code


async def clear_reset_code(redis: Redis, session_id: str):
    """
    Clear the reset information attached to the session associated with the passed
    `session_id`.

    :param redis: the application redis client
    :param session_id: the session id

    """

    unparsed_session, session_expiry = await asyncio.gather(
        redis.get(session_id), redis.ttl(session_id)
    )

    if not unparsed_session:
        return

    session = json.loads(unparsed_session)

    await redis.set(
        session_id,
        json.dumps(
            {
                key: session[key]
                for key in session
                if key not in {"reset_code", "reset_remember", "reset_user_id"}
            },
            cls=CustomEncoder,
        ),
        expire=session_expiry,
    )


async def replace_session(
    db: DB,
    redis: Redis,
    session_id: str,
    ip: str,
    user_id: Optional[str] = None,
    remember: Optional[bool] = False,
) -> Tuple[str, dict, str]:
    """
    Replace the session associated with `session_id` with a new one. Return the new
    session document.

    Supplying a `user_id` indicates the session is authenticated. Setting `remember`
    will make the session last for 30 days instead of the default 30 minutes.

    :param db: the application database client
    :param redis: the application redis pool
    :param session_id: the id of the session to replace
    :param ip:
    :param user_id:
    :param remember:
    :return: new session document and token
    """
    await redis.delete(session_id)
    return await create_session(db, redis, ip, user_id, remember=remember)
