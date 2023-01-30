import asyncio

from aiohttp.web_request import Request

from virtool.authorization.permissions import PermissionType, ResourceType
from virtool.authorization.utils import get_authorization_client_from_req
from virtool.mongo.core import DB


async def check(req: Request, permission: PermissionType) -> bool:
    """
    Check if the user has the given permission.

    :param req: the request object
    :param permission: the permission to check
    :return: ``True`` if the user has the permission, ``False`` otherwise

    """
    if req["client"].admin:
        return True

    user_id = req["client"].user_id

    if req["client"].user_id is None:
        return False

    return any(
        await asyncio.gather(
            check_in_mongo(req["db"], req["client"].user_id, permission),
            get_authorization_client_from_req(req).check(
                user_id, permission, ResourceType.SPACE, 0
            ),
        ),
    )


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
