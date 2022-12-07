from virtool_core.models.enums import Permission

from virtool.api.response import NotFound
from virtool.mongo.core import DB


async def check_in_mongo(mongo: DB, user_id: str, permission: Permission) -> bool:
    """
    Check permissions in Mongo.
    """

    return (
        await mongo.users.count_documents(
            {"_id": user_id, f"permissions.{permission.name}": True}
        )
        == 1
    )


async def list_permissions_in_mongo(mongo: DB, user_id: str) -> dict:
    """
    List user permissions in Mongo.
    """
    try:
        user = await mongo.users.find_one(user_id, ["permissions"])
        return user["permissions"]
    except TypeError:
        raise NotFound
