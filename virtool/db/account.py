import uuid
from typing import Tuple

import virtool.db.iface
import virtool.db.users
import virtool.users
import virtool.utils


def compose_password_update(user_id: str, old_password: str, password: str) -> dict:
    """
    Compose an update dict for self-changing a users account password. This will disable forced reset and won't
    invalidate current sessions, unlike a password change by an administrator.

    :param user_id: the id of the user to be updated
    :param old_password: the old password for authorization
    :param password: the new password
    :return: a password update

    """
    # Update the user document. Remove all sessions so those clients will have to authenticate with the new
    # password.
    return {
        "password": virtool.users.hash_password(password),
        "invalidate_sessions": False,
        "last_password_change": virtool.utils.timestamp(),
        "force_reset": False
    }


async def get_alternate_id(db: virtool.db.iface.DB, name: str) -> str:
    """
    Get an alternate id for an API key whose provided `name` is not unique. Appends an integer suffix to the end of the
    `name`.

    :param db: the application database object
    :param name: the API key name
    :return: an alternate unique id for the key

    """
    existing_alt_ids = await db.keys.distinct("id")

    suffix = 0

    while True:
        candidate = f"{name.lower()}_{suffix}"

        if candidate not in existing_alt_ids:
            return candidate

        suffix += 1


def generate_api_key() -> Tuple[str, str]:
    """
    Generate an API key using UUID. Returns a `tuple` containing the raw API key to be returned once to the user and the
    SHA-256 hash of the API key to be stored in the database.

    :return: a new API key

    """
    raw = uuid.uuid4().hex
    return raw, virtool.users.hash_api_key(raw)


async def create_api_key(db: virtool.db.iface.DB, name: str, permissions: dict, user_id: str):
    """
    Create a new API key for the account with the given `user_id`.

    API keys can only receive permissions possessed by the owner of the API key. If the owner is an administrator, their
    key permissions will not be limited.

    Actions that require administrator status cannot be performed using API key authentication.

    :param db: the application database object
    :param name: a display name for the API key
    :param permissions: permissions to provide to the API key
    :param user_id: the id of the owning user
    :return: the API key document

    """
    user = await db.users.find_one(user_id, ["administrator", "groups", "permissions"])

    key_permissions = {
        **{p: False for p in virtool.users.PERMISSIONS},
        **permissions
    }

    if not user["administrator"]:
        key_permissions = virtool.users.limit_permissions(key_permissions, user["permissions"])

    raw, hashed = virtool.db.account.generate_api_key()

    document = {
        "_id": hashed,
        "id": await virtool.db.account.get_alternate_id(db, name),
        "name": name,
        "groups": user["groups"],
        "permissions": key_permissions,
        "created_at": virtool.utils.timestamp(),
        "user": {
            "id": user_id
        }
    }

    await db.keys.insert_one(document)

    del document["_id"]
    del document["user"]

    document["key"] = raw

    return document
