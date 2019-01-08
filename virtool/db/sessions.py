import arrow
import hashlib
import secrets

import virtool.db.utils
import virtool.utils


async def create_session_id(db):
    session_id = secrets.token_hex(32)

    if await db.sessions.count({"_id": session_id}):
        return await create_session_id(db)

    return session_id


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


async def get_session(db, session_id, session_token):
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


async def get_verification_key(db, session_id, mode="login"):
    verification_key = secrets.token_hex(20)

    await db.sessions.update_one({"_id": session_id}, {
        "$set": {
            f"{mode}_verification_key": verification_key
        }
    })

    return verification_key


async def check_verification_key(db, session_id, verification_key, mode="login"):
    db_verification_key = await virtool.db.utils.get_one_field(
        db.sessions,
        f"{mode}_verification_key",
        session_id
    )

    if db_verification_key and db_verification_key == verification_key:
        await db.sessions.update_one({"_id": session_id}, {
            "$unset": {
                f"{mode}_verification_key": ""
            }
        })

        return True


async def get_reset_code(db, session_id, user_id):
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
