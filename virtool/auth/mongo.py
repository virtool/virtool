from typing import List

from virtool_core.models.enums import Permission

from virtool.data.errors import ResourceNotFoundError
from virtool.mongo.core import DB
from virtool.mongo.utils import get_one_field


async def check_in_mongo(mongo: DB, user_id: str, permission: Permission) -> bool:
    """
    Check permissions in Mongo.
    """

    return (
        await mongo.users.count_documents(
            {"_id": user_id, f"permissions.{permission.name}": True}, limit=1
        )
        == 1
    )


async def list_permissions_in_mongo(mongo: DB, user_id: str) -> List[Permission]:
    """
    List user permissions in Mongo.
    """

    permissions = await get_one_field(mongo.users, "permissions", user_id)

    if permissions:
        return sorted(
            [permission for permission in permissions if permissions[permission]]
        )

    raise ResourceNotFoundError()
