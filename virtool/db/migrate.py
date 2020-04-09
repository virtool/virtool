import logging

import pymongo.errors

import virtool.analyses.migrate
import virtool.caches.migrate
import virtool.db.utils
import virtool.jobs.db
import virtool.otus.utils
import virtool.references.migrate
import virtool.samples.migrate
import virtool.subtractions.migrate
import virtool.users.utils
import virtool.utils

logger = logging.getLogger(__name__)


async def delete_unready(collection):
    await collection.delete_many({"ready": False})


async def migrate(app):
    db = app["db"]

    logger.info(" • analyses")
    await virtool.analyses.migrate.migrate_analyses(db, app["settings"])
    await virtool.caches.migrate.migrate_caches(app)
    await migrate_files(db)
    await migrate_groups(db)
    await migrate_jobs(db)
    await migrate_sessions(db)
    await migrate_status(db, app["version"])
    await virtool.samples.migrate.migrate_samples(app)
    await virtool.references.migrate.migrate_references(app)
    await virtool.subtractions.migrate.migrate_subtractions(app)


async def migrate_files(db):
    """
    Make all files unreserved. This is only called when the server first starts.

    """
    logger.info(" • files")

    await db.files.update_many({}, {
        "$set": {
            "reserved": False
        }
    }, silent=True)


async def migrate_groups(db):
    """
    Ensure that the permissions object for each group matches the permissions defined in
    `virtool.users.utils.PERMISSIONS`.

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
                "permissions": {perm: group["permissions"].get(perm, False) for perm in virtool.users.utils.PERMISSIONS}
            }
        }, silent=True)


async def migrate_jobs(db):
    logger.info(" • jobs")
    await virtool.jobs.db.delete_zombies(db)


async def migrate_sessions(db):
    logger.info(" • sessions")

    await db.sessions.delete_many({"created_at": {"$exists": False}})
    await db.sessions.create_index("expiresAt", expireAfterSeconds=0)


async def migrate_status(db, server_version):
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
        if await db.hmm.count_documents({}):
            await db.status.update_one({"_id": "hmm", "installed": {"$exists": False}}, {
                "$set": {
                    "installed": None
                }
            })
