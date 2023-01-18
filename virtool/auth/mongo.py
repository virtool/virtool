from typing import List

from virtool.auth.permissions import PermissionType
from virtool.data.errors import ResourceNotFoundError
from virtool.mongo.core import DB
from virtool.mongo.utils import get_one_field


async def check_in_mongo(mongo: DB, user_id: str, permission: PermissionType) -> bool:
    """
    Check permissions in Mongo.
    """

    return (
        await mongo.users.count_documents(
            {"_id": user_id, f"permissions.{permission.name}": True}, limit=1
        )
        == 1
    )


async def list_permissions_in_mongo(mongo: DB, user_id: str) -> List[PermissionType]:
    """
    List user permissions in Mongo.
    """

    permissions = await get_one_field(mongo.users, "permissions", user_id)

    if permissions:
        return sorted(
            [permission for permission in permissions if permissions[permission]]
        )

    raise ResourceNotFoundError()
