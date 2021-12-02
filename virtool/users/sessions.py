import hashlib
import secrets
from typing import Optional, Tuple

import arrow
import virtool.db.utils
import virtool.utils
from virtool.db.core import DB


async def create_session(
        db,
        ip: str,
        user_id: Optional[str] = None,
        remember: Optional[bool] = False
) -> Tuple[dict, str]:
    session_id = await create_session_id(db)

    utc = arrow.utcnow()

    if user_id and remember:
        expires_at = utc.shift(days=30)

    elif user_id:
        expires_at = utc.shift(minutes=60)

    else:
        expires_at = utc.shift(minutes=10)

    session = {
        "_id": session_id,
        "created_at": virtool.utils.timestamp(),
        "expiresAt": expires_at.datetime,
        "ip": ip
    }

    token = None

    if user_id:
        token, hashed = virtool.utils.generate_key()
        user_document = await db.users.find_one(user_id)

        session.update({
            "token": hashed,
            "administrator": user_document["administrator"],
            "groups": user_document["groups"],
            "permissions": user_document["permissions"],
            "force_reset": user_document["force_reset"],
            "user": {
                "id": user_id
            }
        })

    await db.sessions.insert_one(session)

    return session, token


async def create_session_id(db: virtool.db.core.DB) -> str:
    """
    Create a new unique session id.

    :param db: the application database client
    :return: a session id

    """
    session_id = secrets.token_hex(32)

    if await db.sessions.count_documents({"_id": session_id}):
        return await create_session_id(db)

    return session_id


async def get_session(db: DB, session_id: str, session_token: str) -> Tuple[Optional[dict], Optional[str]]:
    """
    Get a session and token by its id and token.

    If the passed `session_token` is `None`, an unauthenticated session document matching the
    `session_id` will be returned. If the matching session is authenticated and token is passed,
    `None` will be returned.

    Will return `None` if the session doesn't exist or the session id and token do not go together.

    :param db: the application database client
    :param session_id: the session id
    :param session_token: the token for the session
    :return: a session document

    """
    document = await db.sessions.find_one({
        "_id": session_id
    })

    if document is None:
        return None, None

    try:
        document_token = document["token"]
    except KeyError:
        return document, None

    if session_token is None:
        return None, None

    hashed_token = hashlib.sha256(session_token.encode()).hexdigest()

    if document_token == hashed_token:
        return document, session_token


async def create_reset_code(db, session_id: str, user_id: str, remember: Optional[bool] = False) -> int:
    """
    Create a secret code that is used to verify a password reset request. Properties:

    - the reset request must pass a reset code that is associated with the session linked to the
      request
    - the reset code is dropped from the session for any non-reset request sent after the code was
      generated

    :param db:
    :param session_id:
    :param user_id:
    :param remember:
    :return:

    """
    reset_code = secrets.token_hex(32)

    await db.sessions.update_one({"_id": session_id}, {
        "$set": {
            "reset_code": reset_code,
            "reset_remember": remember,
            "reset_user_id": user_id
        }
    })

    return reset_code


async def clear_reset_code(db: virtool.db.core.DB, session_id: str):
    """
    Clear the reset information attached to the session associated with the passed `session_id`.

    :param db: the application database client
    :param session_id: the session id

    """
    await db.sessions.update_one({"_id": session_id}, {
        "$unset": {
            "reset_code": "",
            "reset_remember": "",
            "reset_user_id": ""
        }
    })


async def replace_session(
        db: virtool.db.core.DB,
        session_id: str,
        ip: str,
        user_id: Optional[str] = None,
        remember: Optional[bool] = False
) -> Tuple[dict, str]:
    """
    Replace the session associated with `session_id` with a new one. Return the new session
    document.

    Supplying a `user_id` indicates the session is authenticated. Setting `remember` will make the
    session last for 30 days instead of the default 30 minutes.

    :param db: the application database client
    :param session_id: the id of the session to replace
    :param ip:
    :param user_id:
    :param remember:
    :return: new session document and token
    """
    await db.sessions.delete_one({"_id": session_id})
    return await create_session(db, ip, user_id, remember=remember)
