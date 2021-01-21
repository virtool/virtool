import logging

import pymongo.errors
from motor.motor_asyncio import AsyncIOMotorCollection

import virtool.db.mongo
import virtool.types
from virtool.analyses.migrate import migrate_analyses
from virtool.caches.migrate import migrate_caches
from virtool.groups.migrate import migrate_groups
from virtool.jobs.migrate import migrate_jobs
from virtool.references.migrate import migrate_references
from virtool.samples.migrate import migrate_samples

logger = logging.getLogger(__name__)


async def migrate(app: virtool.types.App):
    """
    Update all collections on application start.

    Used for applying MongoDB schema and file storage changes.

    :param app: the application object

    """
    funcs = (
        migrate_analyses,
        migrate_caches,
        migrate_groups,
        migrate_jobs,
        migrate_sessions,
        migrate_status,
        migrate_samples,
        migrate_references
    )

    for func in funcs:
        name = func.__name__.replace("migrate_", "")
        logger.info(f" • {name}")
        await func(app)


async def migrate_sessions(app: virtool.types.App):
    """
    Add the expiry index to the sessions collection.

    :param app: the application object

    """
    await app["db"].sessions.create_index("expiresAt", expireAfterSeconds=0)


async def migrate_status(app: virtool.types.App):
    """
    Automatically update the status collection.

    :param app: the application object

    """
    db = app["db"]
    server_version = app["version"]

    await db.status.delete_many({
        "_id": {
            "$in": ["software_update", "version"]
        }
    })

    mongo_version = await virtool.db.mongo.get_mongo_version(db)

    await db.status.update_many({}, {
        "$unset": {
            "process": ""
        }
    })

    try:
        await db.status.insert_one({
            "_id": "software",
            "installed": None,
            "mongo_version": mongo_version,
            "releases": list(),
            "task": None,
            "updating": False,
            "version": server_version,
        })
    except pymongo.errors.DuplicateKeyError:
        await db.status.update_one({"_id": "software"}, {
            "$set": {
                "mongo_version": mongo_version,
                "task": None,
                "updating": False,
                "version": server_version
            }
        })

    try:
        await db.status.insert_one({
            "_id": "hmm",
            "installed": None,
            "task": None,
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


async def migrate_subtractions_list(collection: AsyncIOMotorCollection):
    """
    Transform `subtraction` field to a list and rename it as `subtractions`.

    """
    async for document in collection.find({"subtraction": {"$exists": True}}):
        try:
            subtractions = [document["subtraction"]["id"]]
        except TypeError:
            subtractions = list()

        await collection.update_one({"_id": document["_id"]}, {
            "$set": {
                "subtractions": subtractions
            },
            "$unset": {
                "subtraction": ""
            }
        })
