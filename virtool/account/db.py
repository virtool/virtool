"""
Work with the current user account and its API keys.

API Key Schema:
- _id (str) the hashed API key - never returned
- id (str) the API key ID
- name (str) user-defined name for the API key
- groups (Array[str]) list of groups the API key user is a member of
- permissions (Object) user-defined permissions possessed by the key - permission names are keys with boolean values
- created_at (datetime) when the API key was created)
- user (Object) describes the parent user
    id (str) the user ID

"""
import virtool.account.utils
import virtool.users.db
import virtool.users.utils
import virtool.utils

PROJECTION = [
    "_id",
    "administrator",
    "email",
    "groups",
    "identicon",
    "last_password_change",
    "permissions",
    "primary_group",
    "settings"
]


def compose_password_update(password: str) -> dict:
    """
    Compose an update dict for self-changing a users account password. This will disable forced reset and won't
    invalidate current sessions, unlike a password change by an administrator.

    :param password: the new password
    :return: a password update

    """
    # Update the user document. Remove all sessions so those clients will have to authenticate with the new
    # password.
    return {
        "password": virtool.users.utils.hash_password(password),
        "invalidate_sessions": False,
        "last_password_change": virtool.utils.timestamp(),
        "force_reset": False
    }


async def get(db, user_id: str) -> dict:
    """
    Get appropriately projected user document by id.

    :param db: the application database object
    :param user_id: the user id
    :return: the projected user document

    """
    return await db.users.find_one(
        user_id,
        PROJECTION
    )


async def get_alternate_id(db, name: str) -> str:
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


async def create_api_key(db, name: str, permissions: dict, user_id: str) -> dict:
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
        **virtool.users.utils.generate_base_permissions(),
        **permissions
    }

    if not user["administrator"]:
        key_permissions = virtool.users.utils.limit_permissions(key_permissions, user["permissions"])

    raw, hashed = virtool.account.utils.generate_api_key()

    document = {
        "_id": hashed,
        "id": await virtool.account.db.get_alternate_id(db, name),
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
