import arrow
import hashlib
import secrets
from typing import Union

import virtool.db.iface
import virtool.db.utils
import virtool.utils


async def create_session(db, ip, user_id=None, remember=False):
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
        token = secrets.token_hex(32)

        hashed = hashlib.sha256(token.encode()).hexdigest()

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


async def create_session_id(db: virtool.db.iface.DB) -> str:
    """
    Create a new unique session id.

    :param db: the application database client
    :return: a session id

    """
    session_id = secrets.token_hex(32)

    if await db.sessions.count({"_id": session_id}):
        return await create_session_id(db)

    return session_id


async def get_session(db: virtool.db.iface.DB, session_id: str, session_token: str) -> Union[None, dict]:
    """
    Get a session by its id and token.

    If the passed `session_token` is `None`, an unauthenticated session document matching the `session_id` will be
    returned. If the matching session is authenticated and token is passed, `None` will be returned.

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
        return None

    try:
        document_token = document["token"]
    except KeyError:
        return document

    if session_token is None:
        return None

    hashed_token = hashlib.sha256(session_token.encode()).hexdigest()

    if document_token == hashed_token:
        return document


async def get_reset_code(db, session_id, user_id):
    """

    :param db:
    :param session_id:
    :param user_id:
    :return:
    """
    reset_code = secrets.token_hex(20)

    await db.sessions.update_one({"_id": session_id}, {
        "$set": {
            "reset_code": reset_code,
            "reset_user_id": user_id
        }
    })

    return reset_code


async def check_reset_code(db, session_id, reset_code):
    session = await db.sessions.find_one(session_id, ["reset_code", "reset_user_id"])

    db_reset_code = session.get("reset_code", None)

    if db_reset_code and db_reset_code == reset_code:
        await db.sessions.update_one({"_id": session_id}, {
            "$unset": {
                "reset_code": ""
            }
        })

        return True

    return False


async def set_reset_errors(db, session_id, errors=None):
    reset_code = secrets.token_hex(20)

    await db.sessions.update_one({"_id": session_id}, {
        "$set": {
            "reset_code": reset_code,
            "reset_errors": errors or list()
        }
    })

    return reset_code


async def replace_session(db, session_id, ip, user_id=None, remember=False):
    await db.sessions.delete_one({"_id": session_id})
    return await create_session(db, ip, user_id, remember=remember)


async def invalidate_sessions_by_user(db, user_id):
    await db.sessions.delete_many({"user.id": user_id})
