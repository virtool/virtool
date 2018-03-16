import virtool.virus
import virtool.virus_index
import virtool.sample
from virtool.user_permissions import PERMISSIONS
from virtool.user_groups import merge_group_permissions


async def organize_analyses(db):
    """
    Delete any analyses with the ``ready`` field set to ``False``.

    """
    await db.analyses.delete_many({"ready": False})


async def organize_files(db):
    await db.files.update_many({}, {
        "$set": {
            "reserved": False
        }
    })


async def organize_groups(db):
    if not await db.groups.count({"_id": "administrator"}):
        await db.groups.insert_one({
            "_id": "administrator"
        })

    async for group in db.groups.find():
        default_setting = True if group["_id"] == "administrator" else False

        permissions = {perm: default_setting for perm in PERMISSIONS}

        for perm in permissions:
            try:
                permissions[perm] = group["permissions"][perm]
            except KeyError:
                pass

        await db.groups.update_one({"_id": group["_id"]}, {
            "$set": {
                "permissions": permissions
            }
        })


async def organize_indexes(db):
    pass


async def organize_samples(db, settings):
    """
    Bring sample documents up-to-date by doing the following:


    :param db: a Motor connection to the database to update
    :type db: :class:`motor.motor_asyncio.AsyncIOMotorCollection`

    """
    pass


async def organize_status(db, server_version):
    await db.status.update_one({"_id": "software_update"}, {
        "$set": {
            "process": None
        }
    }, upsert=True)

    await db.status.update_one({"_id": "version"}, {
        "$set": {
            "version": server_version
        }
    }, upsert=True)


async def organize_subtraction(db):
    await db.subtraction.delete_many({"ready": False})


async def organize_users(db):
    # Make sure permissions are correct for all users.
    async for user in db.users.find():
        groups = await db.groups.find({"_id": {
            "$in": user["groups"]
        }}).to_list(None)

        await db.users.update_one({"_id": user["_id"]}, {
            "$set": {
                "permissions": merge_group_permissions(list(groups))
            }
        })


async def organize_viruses(db):
    pass
