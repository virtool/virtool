import asyncio

import virtool.db.users
import virtool.groups
import virtool.utils


async def get_merged_permissions(db, id_list):
    """
    Get the merged permissions that are inherited as a result of membership in the groups defined in `id_list`.

    :param db: the application database interface

    :param id_list: a list of group ids
    :type id_list: list

    :return: the merged permissions
    :rtype: dict

    """
    groups = await asyncio.shield(db.groups.find({"_id": {"$in": id_list}}, {"_id": False}).to_list(None))
    return virtool.groups.merge_group_permissions(groups)


async def update_member_users(db, group_id, remove=False):
    groups = await asyncio.shield(db.groups.find().to_list(None))

    async for user in db.users.find({"groups": group_id}, ["administrator", "groups", "permissions", "primary_group"]):
        if remove:
            user["groups"].remove(group_id)

        new_permissions = virtool.groups.merge_group_permissions(
            [group for group in groups if group["_id"] in user["groups"]]
        )

        # Skip updating this user if their group membership and permissions haven't changed.
        if not remove and new_permissions == user["permissions"]:
            continue

        update_dict = {
            "$set": {
                "permissions": new_permissions
            }
        }

        if user["primary_group"] == group_id:
            update_dict["$set"]["primary_group"] = ""

        if remove:
            update_dict["$pull"] = {
                "groups": group_id
            }

        document = await db.users.find_one_and_update(
            {"_id": user["_id"]},
            update_dict,
            projection=["groups", "permissions"]
        )

        await virtool.db.users.update_sessions_and_keys(
            db,
            user["administrator"],
            user["_id"],
            document["groups"],
            document["permissions"]
        )
