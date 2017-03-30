import bcrypt
import hashlib

from pymongo import ReturnDocument


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


def processor(document):
    document["user_id"] = document.pop("_id")
    return document


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


async def invalidate_session(db, token, logout=False):
    """
    Invalidate the session identified by the passed token. Can be called as the result of a logout or a forced
    invalidation by a user with the *modify_options* permission.

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

    '''
    if removed_count:
        self._dispatch({
            "operation": "deauthorize",
            "data": {
                "logout": logout
            }
        }, conn_filter=lambda conn: conn.user["token"] == token)

        return True

    return False
    '''


async def validate_credentials(db, user_id, password):
    """
    Returns ``True`` if the username exists and the password is correct. Returns ``False`` if the username does not
    exist or the or the password is incorrect.

    :param db: a database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param user_id: the username to check.
    :type user_id: str

    :param password: the password to check.
    :type password: str

    :return: validation success
    :rtype: bool

    """
    document = await db.users.find_one({"_id": user_id}, ["password", "salt"])

    # First, check if the user exists in the database. Return False if the user does not exist.
    if not document:
        return False

    # Return True if the attempted password matches the stored password.
    if check_password(password, document["password"]):
        return True

    if "salt" in document and check_legacy_password(password, document["password"], document["salt"]):
        return True

    return False


def hash_password(password):
    """
    Salt and hash a unicode password. Uses bcrypt.

    :param password: a password string to salt and hash
    :type password: str

    :return: a salt and hashed password
    :rtype: tuple

    """
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12))


def check_password(password, hashed):
    """
    Check if a unicode ``password`` matches a ``hashed_password``.

    :param password: the password to check.
    :type password: str

    :param hashed: the salted and hashed password from the database
    :type hashed: str

    :return: success of test
    :rtype: bool

    """
    return bcrypt.checkpw(password.encode(), hashed)


def check_legacy_password(password, salt, hashed):
    """
    Check if a unicode ``password`` and ``salt`` match a ``hashed`` password from the database. This is for use only
    with legacy SHA512 hashed passwords. New password hash with :func:`.hash_password` will be hashed using bcrypt.
    
    :param password: the password to check
    :type password: str
    
    :param salt: a salt
    :type salt: str

    :param hashed: the hashed password from the database
    :type hashed: str

    :return: success of test
    :rtype: bool
     
    """
    return hashed == hashlib.sha512(salt.encode("utf-8") + password.encode("utf-8")).hexdigest()


class UserNotFoundError(Exception):
    pass


class GroupNotFoundError(Exception):
    pass
