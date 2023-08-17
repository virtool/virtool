"""
Database utilities for groups.

"""

import asyncio
from asyncio import gather
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorClientSession
from virtool_core.models.group import Group, Permissions
from virtool_core.models.user import UserNested
from virtool.groups.pg import SQLGroup
from virtool.pg.utils import get_row, get_row_by_id

import virtool.users.db
import virtool.utils
from virtool.groups.utils import merge_group_permissions
from virtool.utils import base_processor


async def create_group_from_row(mongo, pg_group) -> Group:
    return Group(
        id=pg_group.legacy_id,
        name=pg_group.name,
        permissions=Permissions(**pg_group.permissions),
        users=await fetch_group_users(mongo, pg_group.legacy_id),
    )


async def fetch_group_from_mongo(mongo, group_id) -> Optional[Group]:
    document, users = await gather(
        mongo.groups.find_one({"_id": group_id}), fetch_group_users(mongo, group_id)
    )

    if document:
        return Group(**base_processor(document), users=users)

    return None


async def fetch_complete_group(mongo, pg, group_id: str | int) -> Optional[Group]:
    """
    Search Mongo and Postgres for a Group by its ID.

    :param mongo: The MongoDB client
    :param pg: PostgreSQL AsyncEngine object
    """
    if type(group_id) is int:
        pg_group = await get_row_by_id(pg, SQLGroup, group_id)

        if pg_group:
            return await create_group_from_row(mongo, pg_group)

        return None

    pg_group, mongo_group = await asyncio.gather(
        get_row(pg, SQLGroup, ("legacy_id", group_id)),
        fetch_group_from_mongo(mongo, group_id),
    )

    if pg_group:
        return await create_group_from_row(mongo, pg_group)

    if mongo_group:
        return mongo_group

    return None


async def get_merged_permissions(mongo, id_list: List[str]) -> dict:
    """
    Get the merged permissions that are inherited as a result of membership in the groups defined in `id_list`.

    :param mongo: The MongoDB client
    :param id_list: a list of group ids
    :return: the merged permissions

    """
    groups = await asyncio.shield(
        mongo.groups.find({"_id": {"$in": id_list}}, {"_id": False}).to_list(None)
    )
    return merge_group_permissions(groups)


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


async def fetch_group_users(mongo, group_id: str) -> List[UserNested]:
    return [
        UserNested(**base_processor(user))
        async for user in mongo.users.find({"groups": group_id})
    ]


def lookup_group_minimal_by_id(
    local_field: str = "group", set_as: str = "group"
) -> List[dict]:
    """
    Return a list of aggregation pipeline stages to lookup a group by its id and return
    only the ``_id`` and ``name`` fields.

    """
    return [
        {
            "$lookup": {
                "from": "groups",
                "let": {"group_id": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$_id", "$$group_id"]}}},
                    {"$project": {"_id": False, "id": "$_id", "name": True}},
                ],
                "as": set_as,
            },
        },
        {"$set": {set_as: {"$first": f"${set_as}"}}},
    ]


def lookup_groups_minimal_by_id(
    local_field: str = "groups",
    set_as: str = "groups",
) -> List[dict]:
    """
    Return a list of aggregation pipeline stages to lookup a group by its id and return
    only the ``_id`` and ``name`` fields.

    """
    return [
        {
            "$lookup": {
                "from": "groups",
                "let": {"group_ids": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$in": ["$_id", "$$group_ids"]}}},
                    {"$project": {"_id": False, "id": "$_id", "name": True}},
                    {"$sort": {"name": 1}},
                ],
                "as": set_as,
            },
        },
    ]
