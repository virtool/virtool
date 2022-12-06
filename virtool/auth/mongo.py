from typing import List

from virtool_core.models.enums import Permission

from virtool.api.response import NotFound
from virtool.data.errors import ResourceNotFoundError
from virtool.data.layer import DataLayer
from virtool.groups.oas import UpdateGroupRequest
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


async def add_in_mongo(data: DataLayer, group_id: str, permissions: List[Permission]):
    """
    Add a permission to a group in Mongo.
    """
    permission_dict = {permission.name: True for permission in permissions}

    data_dict = UpdateGroupRequest(permissions=permission_dict)

    try:
        await data.groups.update(group_id, data_dict)
    except ResourceNotFoundError:
        raise NotFound()


async def remove_in_mongo(
    data: DataLayer, group_id: str, permissions: List[Permission]
):
    """
    Remove a permission from a group in Mongo.
    """
    permission_dict = {permission.name: False for permission in permissions}

    data_dict = UpdateGroupRequest(permissions=permission_dict)

    try:
        await data.groups.update(group_id, data_dict)
    except ResourceNotFoundError:
        raise NotFound()
