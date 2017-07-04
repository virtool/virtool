import bcrypt
import hashlib

from pymongo import ReturnDocument

PROJECTION = [
    "_id",
    "groups",
    "force_reset",
    "last_password_change",
    "permissions",
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
    try:
        if check_password(password, document["password"]):
            return True
    except TypeError:
        pass

    if "salt" in document and check_legacy_password(password, document["salt"], document["password"]):
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
