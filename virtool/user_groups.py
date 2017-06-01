from virtool.user_permissions import PERMISSIONS


projection = ["_id", "permissions"]


def processor(document):
    document["group_id"] = document.pop("_id")
    return document


def merge_group_permissions(groups):
    """
    Return a :class:`dict` of permissions that will be inherited by a user belonging to all the passed ``groups``.

    :param groups: a list of group documents.
    :return: a dict keyed by permission names with boolean values indicating the state of the permission

    """
    permission_dict = {permission_name: False for permission_name in PERMISSIONS}

    for permission_name in PERMISSIONS:
        for group in groups:
            try:
                if group["permissions"][permission_name]:
                    permission_dict[permission_name] = True
            except KeyError:
                permission_dict[permission_name] = False

    return permission_dict


async def get_member_users(db, group_id):
    return await db.users.find({"groups": group_id}).distinct("_id")


async def update_member_users(db, group_id, remove=False):
    groups = await db.groups.find().to_list(length=None)

    member_users = await db.users.find({"groups": group_id}).to_list(None)

    for user in member_users:
        if remove:
            user["groups"].pop(group_id)

        new_permissions = merge_group_permissions([group for group in groups if group["_id"] in user["groups"]])

        # Skip updating this user if their group membership and permissions haven't changed.
        if not remove and new_permissions == user["permissions"]:
            continue

        update_dict = {
            "$set": {
                "permissions": new_permissions
            }
        }

        if remove:
            update_dict["$pull"] = {
                "groups": group_id
            }

        await db.users.update(user["_id"], update_dict)
