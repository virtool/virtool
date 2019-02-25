import logging

import pymongo.errors

import virtool.db.analyses
import virtool.db.history
import virtool.db.otus
import virtool.db.references
import virtool.db.samples
import virtool.db.utils
import virtool.otus
import virtool.references
import virtool.users
import virtool.utils

logger = logging.getLogger(__name__)


async def delete_unready(collection):
    await collection.delete_many({"ready": False})


async def organize(app):
    db = app["db"]
    settings = app["settings"]
    server_version = app["version"]

    await organize_analyses(app)
    await organize_files(db)
    await organize_groups(db)
    await organize_sessions(db)
    await organize_status(db, server_version)
    await organize_subtraction(db)
    await organize_samples(db)


async def organize_analyses(app):
    """
    Remove orphaned analysis directories.

    :param app:
    """
    logger.info(" • analyses")

    await virtool.db.analyses.remove_orphaned_directories(app)


async def organize_files(db):
    """
    Make all files unreserved. This is only called when the server first starts.

    :param db:
    """
    logger.info(" • files")

    await db.files.update_many({}, {
        "$set": {
            "reserved": False
        }
    }, silent=True)


async def organize_groups(db):
    """
    Ensure that the permissions object for each group matches the permissions defined in `virtool.users.PERMISSIONS`.

    :param db:

    """
    logger.info(" • groups")

    await db.groups.update_many({}, {
        "$unset": {
            "_version": ""
        }
    })

    async for group in db.groups.find():
        await db.groups.update_one({"_id": group["_id"]}, {
            "$set": {
                "permissions": {perm: group["permissions"].get(perm, False) for perm in virtool.users.PERMISSIONS}
            }
        }, silent=True)


async def organize_samples(db):
    motor_client = db.motor_client

    for sample_id in await motor_client.samples.distinct("_id"):
        await virtool.db.samples.recalculate_algorithm_tags(motor_client, sample_id)


async def organize_sessions(db):
    logger.info(" • sessions")

    await db.sessions.delete_many({"created_at": {"$exists": False}})
    await db.sessions.create_index("expiresAt", expireAfterSeconds=0)


async def organize_status(db, server_version):
    logger.info(" • status")

    await db.status.delete_many({
        "_id": {
            "$in": ["software_update", "version"]
        }
    })

    try:
        await db.status.insert_one({
            "_id": "software",
            "installed": None,
            "process": None,
            "releases": list(),
            "updating": False,
            "version": server_version,
        })
    except pymongo.errors.DuplicateKeyError:
        await db.status.update_one({"_id": "software"}, {
            "$set": {
                "process": None,
                "updating": False,
                "version": server_version
            }
        })

    try:
        await db.status.insert_one({
            "_id": "hmm",
            "installed": None,
            "process": None,
            "updates": list(),
            "release": None
        })
    except pymongo.errors.DuplicateKeyError:
        if await db.hmm.count():
            await db.status.update_one({"_id": "hmm", "installed": {"$exists": False}}, {
                "$set": {
                    "installed": None
                }
            })


async def organize_subtraction(db):
    logger.info(" • subtraction")
    await delete_unready(db.subtraction)
