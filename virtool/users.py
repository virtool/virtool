import hashlib

import bcrypt

#: A list of the permission strings used by Virtool.
PERMISSIONS = [
    "cancel_job",
    "create_ref",
    "create_sample",
    "modify_hmm",
    "modify_subtraction",
    "remove_file",
    "remove_job",
    "upload_file"
]


def calculate_identicon(user_id: str) -> str:
    """
    Calculate an identicon hash string based on a user name.

    :param user_id: the user name
    :return: an identicon string

    """
    return hashlib.sha256(user_id.encode()).hexdigest()


def check_api_key(key: str, hashed: str) -> bool:
    """
    Check a API key string against a hashed one from the user database.

    :param key: the API key to check
    :type key: str

    :param hashed: the hashed key to check against
    :type hashed: str

    """
    return hash_api_key(key) == hashed


def check_legacy_password(password: str, salt: str, hashed: str) -> bool:
    """
    Check if a unicode ``password`` and ``salt`` match a ``hashed`` password from the database. This is for use only
    with legacy SHA512 hashed passwords. New password hash with :func:`.hash_password` will be hashed using bcrypt.

    :param password: the password to check
    :param salt: a salt
    :param hashed: the hashed password from the database
    :return: success of test

    """
    return hashed == hashlib.sha512(salt.encode("utf-8") + password.encode("utf-8")).hexdigest()


def check_password(password: str, hashed: bytes) -> bool:
    """
    Check if a unicode ``password`` matches a ``hashed_password``.

    :param password: the password to check.
    :param hashed: the salted and hashed password from the database
    :return: success of test

    """
    return bcrypt.checkpw(password.encode(), hashed)


def hash_api_key(key: str) -> str:
    """
    Hash an API key using SHA256.

    :param key: the API key to hash
    :return: the hashed key

    """
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """
    Salt and hash a unicode password. Uses bcrypt.

    :param password: a password string to salt and hash
    :return: a salt and hashed password

    """
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12))


def limit_permissions(permissions: dict, limit_filter: dict) -> dict:
    """
    Make sure permission values in `permissions` do not exceed those in `limit_filter`. Returns a filtered set of
    permissions.

    :param limit_filter: the limiting permissions that cannot be exceeded
    :param permissions: a permissions to filter
    :return: filtered permissions

    """
    return {p: (permissions.get(p, False) and limit_filter[p]) for p in permissions}
