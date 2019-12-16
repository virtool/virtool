import logging
import os
import re

import pymongo.errors

import virtool.analyses.db
import virtool.analyses.migrate
import virtool.caches.migrate
import virtool.history.db
import virtool.jobs.db
import virtool.otus.db
import virtool.references.db
import virtool.samples.db
import virtool.samples.migrate
import virtool.db.utils
import virtool.otus.utils
import virtool.references.utils
import virtool.users.utils
import virtool.utils

logger = logging.getLogger(__name__)

RE_FILE_PREFIX = re.compile("^[0-9a-z]{8}-")


async def delete_unready(collection):
    await collection.delete_many({"ready": False})


async def migrate(app):
    db = app["db"]
    server_version = app["version"]

    logger.info(" • analyses")
    await virtool.analyses.migrate.migrate_analyses(db, app["settings"])
    await virtool.caches.migrate.migrate_caches(app)
    await migrate_files(db)
    await migrate_groups(db)
    await migrate_sessions(db)
    await migrate_status(db, app["version"])
    await migrate_subtraction(db)
    await migrate_samples(app)


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
                "permissions": {perm: group["permissions"].get(perm, False) for perm in virtool.users.utils.PERMISSIONS}
            }
        }, silent=True)


async def migrate_jobs(app):
    logger.info(" • jobs")
    motor_client = app["db"].motor_client

    await virtool.jobs.db.delete_zombies(motor_client)


async def migrate_samples(app):
    motor_client = app["db"].motor_client

    for sample_id in await motor_client.samples.distinct("_id"):
        await virtool.samples.db.recalculate_algorithm_tags(motor_client, sample_id)

    samples_path = os.path.join(app["settings"]["data_path"], "samples")

    # Update how files are represented in sample documents.
    async for document in motor_client.samples.find({"files.raw": {"$exists": False}}):
        files = list()

        sample_id = document["_id"]

        for index, file in enumerate(document["files"]):
            name = f"reads_{index + 1}.fastq"

            path = os.path.join(samples_path, sample_id, name)

            try:
                stats = virtool.utils.file_stats(path)
            except FileNotFoundError:
                stats = {
                    "size": None
                }

            files.append({
                "name": name,
                "download_url": f"/download/samples/{sample_id}/{name}",
                "size": stats["size"],
                "raw": False,
                "from": {
                    "id": file,
                    "name": RE_FILE_PREFIX.sub("", file),
                    "size": stats["size"]
                }
            })

        await motor_client.samples.update_one({"_id": sample_id}, {
            "$set": {
                "files": files
            }
        })

    paired_query = {
       "paired": {
           "$exists": False
       }
    }

    await motor_client.samples.update_many({**paired_query, "files": {"$size": 1}}, {
        "$set": {
            "paired": False
        }
    })

    await motor_client.samples.update_many({**paired_query, "files": {"$size": 2}}, {
        "$set": {
            "paired": True
        }
    })

    await virtool.samples.migrate.add_library_type(motor_client)


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
        if await db.hmm.count():
            await db.status.update_one({"_id": "hmm", "installed": {"$exists": False}}, {
                "$set": {
                    "installed": None
                }
            })


async def migrate_subtraction(db):
    logger.info(" • subtraction")
    await delete_unready(db.subtraction)
