"""
MongoDB database utilities for groups.

"""

import asyncio
from asyncio import gather
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorClientSession
from virtool_core.models.group import Group
from virtool_core.models.user import UserNested

import virtool.users.db
import virtool.utils
from virtool.groups.utils import merge_group_permissions
from virtool.utils import base_processor


async def fetch_complete_group(db, group_id: str) -> Optional[Group]:
    document, users = await gather(
        db.groups.find_one({"_id": group_id}), fetch_group_users(db, group_id)
    )

    if document:
        return Group(**base_processor(document), users=users)

    return None


async def get_merged_permissions(db, id_list: List[str]) -> dict:
    """
    Get the merged permissions that are inherited as a result of membership in the groups defined in `id_list`.

    :param db: the application database interface
    :param id_list: a list of group ids
    :return: the merged permissions

    """
    groups = await asyncio.shield(
        db.groups.find({"_id": {"$in": id_list}}, {"_id": False}).to_list(None)
    )
    return merge_group_permissions(groups)


async def update_member_users(
    db,
    group_id: str,
    remove: bool = False,
    session: Optional[AsyncIOMotorClientSession] = None,
):
    groups = await db.groups.find({}, session=session).to_list(None)

    async for user in db.users.find(
        {"groups": group_id},
        ["administrator", "groups", "permissions", "primary_group"],
        session=session,
    ):
        if remove:
            user["groups"].remove(group_id)

        new_permissions = merge_group_permissions(
            [group for group in groups if group["_id"] in user["groups"]]
        )

        # Skip updating this user if their group membership and permissions haven't changed.
        if not remove and new_permissions == user["permissions"]:
            continue

        update_dict = {"$set": {"permissions": new_permissions}}

        if user["primary_group"] == group_id:
            update_dict["$set"]["primary_group"] = ""

        if remove:
            update_dict["$pull"] = {"groups": group_id}

        document = await db.users.find_one_and_update(
            {"_id": user["_id"]},
            update_dict,
            projection=["groups", "permissions"],
            session=session,
        )

        await virtool.users.db.update_sessions_and_keys(
            db,
            user["administrator"],
            user["_id"],
            document["groups"],
            document["permissions"],
            session=session,
        )


async def fetch_group_users(db, group_id: str) -> List[UserNested]:
    return [
        UserNested(**base_processor(user))
        async for user in db.users.find({"groups": group_id})
    ]


def lookup_minimal_groups(
    local_field: str = "groups", set_as: str = "groups"
) -> list[dict]:
    """
    Create a mongoDB aggregation pipeline step to look up minimal groups.

    :param local_field: groups field to look up
    :param set_as: desired name of the returned record
    :return: mongoDB aggregation steps for use in an aggregation pipeline
    """
    return [
        {
            "$lookup": {
                "from": "groups",
                "let": {"group_ids": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$in": ["$_id", "$$group_ids"]}}},
                    {"$project": {"name": True}},
                ],
                "as": set_as,
            }
        },
    ]


def lookup_minimal_group_by_id(
    local_field: str = "group", set_as: str = "group"
) -> list[dict]:
    """
    Create a mongoDB aggregation pipeline step to look up a minimal group by id.

    :param local_field: groups field to look up
    :param set_as: desired name of the returned record
    :return: mongoDB aggregation steps for use in an aggregation pipeline
    """
    return [
        {
            "$lookup": {
                "from": "groups",
                "let": {"group_id": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", "$$group_id"]}}},
                    {"$project": {"name": True}},
                ],
                "as": set_as,
            }
        },
        {"$set": {set_as: {"$ifNull": [{"$first": f"${set_as}"}, None]}}},
    ]
