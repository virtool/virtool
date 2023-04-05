"""
Work with the current user account and its API keys.

"""
from typing import Any, Dict, List, Optional

from virtool_core.models.account import APIKey

import virtool.users.utils
import virtool.utils
from virtool.groups.db import lookup_groups_minimal_by_id

ACCOUNT_PROJECTION = (
    "_id",
    "handle",
    "administrator",
    "email",
    "groups",
    "last_password_change",
    "permissions",
    "primary_group",
    "settings",
    "force_reset",
)


def compose_password_update(password: str) -> Dict[str, Any]:
    """
    Compose an update dict for self-changing a users account password.

    This will disable forced reset and won't invalidate current sessions, unlike a
    password change by an administrator.

    :param password: the new password
    :return: a password update

    """
    return {
        "password": virtool.users.utils.hash_password(password),
        "invalidate_sessions": False,
        "last_password_change": virtool.utils.timestamp(),
        "force_reset": False,
    }


async def get_alternate_id(db, name: str) -> str:
    """
    Get an alternate id for an API key whose provided `name` is not unique. Appends an
    integer suffix to the end of the `name`.

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


async def fetch_complete_api_key(mongo, key_id: str) -> Optional[APIKey]:
    """
    Fetch an API key that contains complete group data.

    :param mongo: the application database object
    :param key_id: the API key id
    """
    async for key in mongo.keys.aggregate(
        [
            {"$match": {"id": key_id}},
            *lookup_groups_minimal_by_id(),
            {
                "$project": {
                    "_id": False,
                    "id": True,
                    "administrator": True,
                    "name": True,
                    "groups": True,
                    "permissions": True,
                    "created_at": True,
                }
            },
        ]
    ):
        return APIKey(
            **{**key, "groups": sorted(key["groups"], key=lambda g: g["name"])}
        )

    return None


API_KEY_PROJECTION = {
    "_id": False,
    "user": False,
}
"""
A MongoDB projection to use when returning API key documents to clients.

The key should never be sent to client after its creation.
"""
