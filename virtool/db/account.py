import uuid

import virtool.db.users
import virtool.users
import virtool.utils


async def compose_password_update(db, user_id, old_password, password):
    """
    Compose an update dict for self-changing a users account password. This will disable forced reset and won't
    invalidate current sessions, unlike a password change by an administrator.

    :param db:

    :param user_id: the id of the user to be updated
    :type user_id: str

    :param old_password: the old password for authorization
    :type old_password: str

    :param password: the new password
    :type password: str

    :return: a password update
    :rtype: dict

    """
    # Will evaluate true if the passed username and password are correct.
    if not await virtool.db.users.validate_credentials(db, user_id, old_password or ""):
        raise ValueError("Invalid credentials")

    # Update the user document. Remove all sessions so those clients will have to authenticate with the new
    # password.
    return {
        "password": virtool.users.hash_password(password),
        "invalidate_sessions": False,
        "last_password_change": virtool.utils.timestamp(),
        "force_reset": False
    }


async def get_alternate_id(db, name):
    existing_alt_ids = await db.keys.distinct("id")

    suffix = 0

    while True:
        candidate = f"{name.lower()}_{suffix}"

        if candidate not in existing_alt_ids:
            return candidate

        suffix += 1


def get_api_key():
    raw = uuid.uuid4().hex
    return raw, virtool.users.hash_api_key(raw)
