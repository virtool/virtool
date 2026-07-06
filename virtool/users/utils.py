import bcrypt

from virtool.models.enums import Permission

UNKNOWN_USER_HANDLE = "unknown"
"""Handle of the lost-attribution sentinel user.

Stands in for a real user who has since been deleted (e.g. the owner of an
upload reconstructed during migration).
"""


def check_password(password: str, hashed: bytes) -> bool:
    """Check if a unicode ``password`` matches a ``hashed_password``.

    :param password: the password to check.
    :param hashed: the salted and hashed password from the database
    :return: success of test

    """
    return bcrypt.checkpw(password.encode(), hashed)


def generate_base_permissions() -> dict[str, bool]:
    """Return a `dict` keyed with all Virtool permissions where all the values are
    `False`.

    :return: a permission dictionary
    """
    return {p.value: False for p in Permission}


def hash_password(password: str) -> bytes:
    """Salt and hash a unicode password. Uses bcrypt.

    :param password: a password string to salt and hash
    :return: a salt and hashed password

    """
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12))


def limit_permissions(permissions, limit_filter: dict) -> dict:
    """Make sure permission values in `permissions` do not exceed those in
    `limit_filter`.

    Returns a filtered set of permissions.

    :param limit_filter: the limiting permissions that cannot be exceeded
    :param permissions: a permissions to filter
    :return: filtered permissions
    """
    return {p: (permissions.get(p, False) and limit_filter[p]) for p in permissions}
