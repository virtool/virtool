"""
Database utilities for groups.

"""

from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClientSession

import virtool.users.db
import virtool.utils
from virtool.groups.utils import merge_group_permissions


async def update_member_users(
    mongo,
    group_id: str,
    remove: bool = False,
    session: Optional[AsyncIOMotorClientSession] = None,
):
    groups = await mongo.groups.find({}, session=session).to_list(None)

    async for user in mongo.users.find(
        {"groups": group_id},
        ["administrator", "groups", "permissions", "primary_group"],
        session=session,
    ):
        if remove:
            user["groups"].remove(group_id)

        update_dict = {}

        if remove:
            update_dict["$pull"] = {"groups": group_id}

            if user["primary_group"] == group_id:
                update_dict["$set"]["primary_group"] = ""

        if update_dict:
            await mongo.users.find_one_and_update(
                {"_id": user["_id"]},
                update_dict,
                projection=["groups", "permissions"],
                session=session,
            )

        permissions = merge_group_permissions(
            [group for group in groups if group["_id"] in user["groups"]]
        )

        await virtool.users.db.update_keys(
            mongo,
            user["administrator"],
            user["_id"],
            user["groups"],
            permissions,
            session=session,
        )
