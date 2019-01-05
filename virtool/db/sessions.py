import hashlib
import secrets


async def create_session_id(db):
    session_id = secrets.token_hex(32)

    if await db.sessions.count({"_id": session_id}):
        return await create_session_id(db)

    return session_id


async def create_session(db, ip, user_id=None):
    session_id = await create_session_id(db)

    session = {
        "_id": session_id,
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


async def set_last_path(db, session_id, path):
    await db.sessions.update_one({"_id": session_id}, {
        "$set": {
            "last_path": path
        }
    })


async def replace_session(db, session_id, ip, user_id=None):
    await db.sessions.delete_one({"_id": session_id})
    return await create_session(db, ip, user_id)


async def invalidate_sessions_by_user(db, user_id):
    await db.sessions.delete_many({"user.id": user_id})
