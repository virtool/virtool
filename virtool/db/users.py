from typing import Union

import virtool.db.groups
import virtool.db.utils
import virtool.errors
import virtool.users
import virtool.utils

PROJECTION = [
    "_id",
    "administrator",
    "force_reset",
    "groups",
    "identicon",
    "last_password_change",
    "permissions",
    "primary_group"
]

ACCOUNT_PROJECTION = [
    "_id",
    "administrator",
    "email",
    "groups",
    "identicon",
    "last_password_change",
    "permissions",
    "primary_group",
    "settings"
]


async def attach_identicons(db, users: Union[dict, list]):
    """
    Attach identicon fields to a list of user documents.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param users: user documents to attach identicons to

    :return: the user documents with identicon fields
    :rtype: Union[dict,list]

    """
    if isinstance(users, list):
        user_ids = [u["id"] for u in users]

        cursor = db.users.find({"_id": {"$in": user_ids}}, ["identicon"])

        lookup = {d["_id"]: d["identicon"] async for d in cursor}

        return [dict(u, identicon=lookup[u["id"]]) for u in users]

    identicon = await virtool.db.utils.get_one_field(db.users, "identicon", users["id"])

    return dict(users, identicon=identicon)


def compose_force_reset_update(force_reset):
    """
    Compose a update dict for the database given a `force_reset` value.

    :param force_reset: a force reset value
    :type force_reset: Union[bool, None]

    :return: an update
    :rtype: dict

    """
    if force_reset is None:
        return dict()

    return {
        "force_reset": force_reset,
        "invalidate_sessions": True
    }


async def compose_groups_update(db, groups):
    """
    Compose a update dict for the updating the list of groups a user is a member of.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param groups: the groups to include in the user update
    :type groups: Union[list, None]

    :return: an update
    :rtype: dict

    """
    if groups is None:
        return dict()

    non_existent_groups = await virtool.db.utils.get_non_existent_ids(db.groups, groups)

    if non_existent_groups:
        raise virtool.errors.DatabaseError("Non-existent groups: " + ", ".join(non_existent_groups))

    update = {
        "groups": groups,
        "permissions": await virtool.db.groups.get_merged_permissions(db, groups)
    }

    return update


def compose_password_update(password):
    """
    Compose an update dict for changing a user's password.

    :param password: a new password
    :type password: Union[str, None]

    :return: an update
    :rtype: dict

    """
    if password is None:
        return dict()

    return {
        "password": virtool.users.hash_password(password),
        "last_password_change": virtool.utils.timestamp(),
        "invalidate_sessions": True
    }


async def compose_primary_group_update(db, user_id, primary_group):
    """
    Compose an update dict for changing a user's `primary_group`.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param user_id: the id of the user being updated
    :type user_id: Union[str, None]

    :param primary_group: the primary group to set for the user
    :type primary_group: Union[str, None]

    :return: an update
    :rtype: dict

    """
    if primary_group is None:
        return dict()

    # 'none' is a valid primary group regardless of user membership or existence of the group in the db
    if primary_group != "none":
        if not await virtool.db.utils.id_exists(db.groups, primary_group):
            raise virtool.errors.DatabaseError("Non-existent group: " + primary_group)

        if not await is_member_of_group(db, user_id, primary_group):
            raise virtool.errors.DatabaseError("User is not member of group")

    return {
        "primary_group": primary_group
    }


async def create(db, user_id, password, force_reset=True):
    """
    Insert a new user document into the database.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param user_id: the requested id for the user
    :type user_id: str

    :param password: a password
    :type password: str

    :param force_reset: force the user to reset password on next login
    :type force_reset: bool

    :return: the user document
    :rtype: dict

    """
    if await virtool.db.utils.id_exists(db.users, user_id):
        raise virtool.errors.DatabaseError("User already exists")

    document = {
        "_id": user_id,
        "administrator": False,
        "groups": list(),
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": True,
            "show_versions": True,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        },
        "identicon": virtool.users.calculate_identicon(user_id),
        "permissions": virtool.users.generate_base_permissions(),
        "password": virtool.users.hash_password(password),
        "primary_group": "",
        # Should the user be forced to reset their password on their next login?
        "force_reset": force_reset,
        # A timestamp taken at the last password change.
        "last_password_change": virtool.utils.timestamp(),
        # Should all of the user's sessions be invalidated so that they are forced to login next time they
        # download the client.
        "invalidate_sessions": False
    }

    await db.users.insert_one(document)

    return document


async def edit(db, user_id, administrator=None, force_reset=None, groups=None, password=None, primary_group=None):
    if not await virtool.db.utils.id_exists(db.users, user_id):
        raise virtool.errors.DatabaseError("User does not exist")

    update = dict()

    if administrator is not None:
        update["administrator"] = administrator

    update.update({
        **compose_force_reset_update(force_reset),
        **compose_password_update(password)
    })

    groups_update = await compose_groups_update(db, groups)
    primary_group_update = await compose_primary_group_update(db, user_id, primary_group)

    update.update({
        **groups_update,
        **primary_group_update
    })

    if not update:
        return await db.users.find_one({"_id": user_id})

    document = await db.users.find_one_and_update({"_id": user_id}, {
        "$set": update
    })

    await update_sessions_and_keys(
        db,
        user_id,
        document["administrator"],
        document["groups"],
        document["permissions"]
    )

    return document


async def is_member_of_group(db, user_id, group_id):
    return bool(await db.users.count({"_id": user_id, "groups": group_id}))


async def validate_credentials(db, user_id, password):
    """
    Returns ``True`` if the username exists and the password is correct. Returns ``False`` if the username does not
    exist or the or the password is incorrect.

    :param db: a database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param user_id: the username to check.
    :type user_id: str

    :param password: the password to check.
    :type password: str

    :return: validation success
    :rtype: Coroutine[bool]

    """
    document = await db.users.find_one(user_id, ["password", "salt"])

    # First, check if the user exists in the database. Return False if the user does not exist.
    if not document:
        return False

    # Return True if the attempted password matches the stored password.
    try:
        if virtool.users.check_password(password, document["password"]):
            return True
    except TypeError:
        pass

    if "salt" in document and virtool.users.check_legacy_password(password, document["salt"], document["password"]):
        return True

    return False


async def update_sessions_and_keys(db, user_id, administrator, groups, permissions):
    """

    :param db: a database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param user_id: the id of the user to update keys and session for
    :type user_id: str

    :param administrator: the administrator flag for the user
    :type administrator: bool

    :param groups: an updated list of groups
    :type groups: list

    :param permissions: an updated set of permissions derived from the updated groups
    :type permissions: dict

    """
    find_query = {
        "user.id": user_id
    }

    async for document in db.keys.find(find_query, ["permissions"]):
        await db.keys.update_one({"_id": document["_id"]}, {
            "$set": {
                "administrator": administrator,
                "groups": groups,
                "permissions": virtool.users.limit_permissions(document["permissions"], permissions)
            }
        })

    await db.sessions.update_many(find_query, {
        "$set": {
            "administrator": administrator,
            "groups": groups,
            "permissions": permissions
        }
    })
