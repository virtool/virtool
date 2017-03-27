import bcrypt
from pymongo import ReturnDocument

ACCOUNT_SETTINGS = {
    "show_ids": False,
    "show_versions": False,
    "quick_analyze_algorithm": None,
    "skip_quick_analyze_dialog": False
}


projector = [
    "_id",
    "_version",
    "groups",
    "sessions",
    "force_reset",
    "last_password_change",
    "permissions",
    "settings",
    "primary_group"
]


async def user_exists(db, user_id):
    return await db.users.find({"_id": user_id}).count() == 1


async def set_primary_group(db, user_id, group_id):
    """
    Set the primary group for a given user.

    """
    if not await user_exists(db, user_id):
        raise UserNotFoundError

    if group_id not in await db.groups.distinct("_id"):
        raise GroupNotFoundError

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": {
            "primary_group": group_id
        }
    }, return_document=ReturnDocument.AFTER)

    return document


async def validate_login(db, user_id, password):
    """
    Returns ``True`` if the username exists and the password is correct. Returns ``False`` if the username does not
    exist or the or the password is incorrect.
    
    :param db: a database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param user_id: the username to check.
    :type user_id: str

    :param password: the password to check.
    :type password: str

    :return: ``True`` if valid, otherwise ``False``.
    :rtype: bool

    """
    document = await db.users.find_one({"_id": user_id})

    # First, check if the user exists in the database. Return False if the user does not exist.
    if not document:
        return False

    # Return True if the attempted password matches the stored password.
    if check_password(password, document["password"], document["salt"]):
        return document


async def invalidate_session(db, token, logout=False):
    """
    Invalidate the session identified by the passed token. Can be called as the result of a logout or a forced
    invalidation by a user with the *modify_options* permission.
    
    :param db: a database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    """
    session_count = await db.users.find({"sessions.0.token": token}).count()

    if session_count > 1:
        raise ValueError("Multiple sessions matching token {}".format(token))

    response = db.users.update({"sessions.0.token": token}, {
        "$pull": {
            "sessions": {
                "token": token
            }
        }
    })

    removed_count = len(response["_ids"])

    if removed_count:
        self._dispatch({
            "operation": "deauthorize",
            "data": {
                "logout": logout
            }
        }, conn_filter=lambda conn: conn.user["token"] == token)

        return True

    return False


def salt_hash(password):
    """
    Salt and hash a password. This function is used for generating new salts and salted and hashed passwords for users.

    :param password: the string to salt and hash.
    :type password: str

    :return: a salt and hashed password.
    :rtype: tuple

    """
    salt = bcrypt.gensalt()

    hashed = bcrypt.hashpw(password.encode(), salt)

    return salt, hashed


def check_password(password, hashed, salt):
    """
    Check if the plain text ``password`` matches the ``hashed_password`` and ``salt``. Returns ``True`` if they match.

    :param password: the plain text password to check.
    :type password: str

    :param hashed: the salted and hashed password from the database
    :type salt: str

    :param salt: the salt to apply to the hashed password
    :type salt: str

    :return: ``True`` if there is a match; ``False`` if not
    :rtype: bool

    """
    return bcrypt.hashpw(password.encode(), salt) == hashed


class UserNotFoundError(Exception):
    pass


class GroupNotFoundError(Exception):
    pass
