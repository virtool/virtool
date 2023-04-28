from typing import TYPE_CHECKING

from motor.motor_asyncio import AsyncIOMotorClientSession
from virtool_core.models.roles import AdministratorRole

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


async def update_legacy_administrator(
    mongo: "Mongo",
    user_id: str,
    role: AdministratorRole,
    session: AsyncIOMotorClientSession = None,
):
    """
    Update the legacy administrator field for a user.
    """

    await mongo.users.update_one(
        {"_id": user_id},
        {"$set": {"administrator": role == AdministratorRole.FULL}},
        session=session,
    )
