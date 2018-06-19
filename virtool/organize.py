import logging
import os
import pymongo.errors
import shutil

import virtool.db.references
import virtool.db.utils
import virtool.references
import virtool.users
import virtool.utils

logger = logging.getLogger(__name__)

REFERENCE_QUERY = {
    "reference": {
        "$exists": False
    }
}


async def add_original_reference(collection):
    await collection.update_many(REFERENCE_QUERY, {
        "$set": {
            "reference": {
                "id": "original"
            }
        }
    })


async def delete_unready(collection):
    await collection.delete_many({"ready": False})


async def organize(db, settings, server_version):
    await organize_analyses(db)
    await organize_files(db)
    await organize_history(db)
    await organize_indexes(db)
    await organize_users(db)
    await organize_groups(db)
    await organize_references(db, settings)
    await organize_otus(db)
    await organize_sequences(db)
    await organize_status(db, server_version)
    await organize_subtraction(db)

    await organize_paths(db, settings)

    await organize_dev(db)


async def organize_dev(db):
    await db.references.update_many({"groups": {"$exists": False}}, {
        "$set": {
            "groups": []
        }
    })


async def organize_analyses(db):
    """
    Delete any analyses with the ``ready`` field set to ``False``.

    """
    logger.info(" • analyses")

    await delete_unready(db.analyses)
    await add_original_reference(db.analyses)


async def organize_files(db):
    logger.info(" • files")

    await db.files.update_many({}, {
        "$set": {
            "reserved": False
        }
    })


async def organize_groups(db):
    logger.info(" • groups")

    await db.groups.delete_one({"_id": "administrator"})

    async for group in db.groups.find():
        await db.groups.update_one({"_id": group["_id"]}, {
            "$set": {
                "permissions": {perm: group["permissions"].get(perm, False) for perm in virtool.users.PERMISSIONS}
            }
        })


async def organize_history(db):
    logger.info(" • history")

    document_ids = await db.history.distinct("_id", {"reference": {"$exists": False}})

    document_ids = [_id for _id in document_ids if ".removed" in _id or ".0" in _id]

    await db.history.update_many({"_id": {"$in": document_ids}}, {
        "$set": {
            "diff.reference": {
                "id": "original"
            },
            "reference": {
                "id": "original"
            }
        }
    })


async def organize_indexes(db):
    logger.info(" • indexes")

    await add_original_reference(db.indexes)


async def organize_otus(db):
    logger.info(" • otus")

    if "otus" in await db.collection_names():
        return

    if "viruses" in await db.collection_names():
        await db.viruses.rename("otus")

    if "kinds" in await db.collection_names():
        await db.kinds.rename("otus")

    await add_original_reference(db.otus)


async def organize_paths(db, settings):
    logger.info("Checking paths...")

    data_path = settings["data_path"]

    old_reference_path = os.path.join(data_path, "reference")

    if os.path.exists(old_reference_path):
        old_indexes_path = os.path.join(old_reference_path, "viruses")

        if not os.path.exists(old_indexes_path):
            old_indexes_path = os.path.join(old_reference_path, "otus")

        if not os.path.exists(old_indexes_path):
            old_indexes_path = None

        if old_indexes_path:
            references_path = os.path.join(data_path, "references")

            os.mkdir(references_path)

            if await db.references.count({"_id": "original"}):
                os.rename(old_indexes_path, os.path.join(references_path, "original"))

        old_subtractions_path = os.path.join(old_reference_path, "subtraction")

        if os.path.exists(old_subtractions_path):
            os.rename(old_subtractions_path, os.path.join(data_path, "subtractions"))

        shutil.rmtree(old_reference_path)


async def organize_references(db, settings):
    logger.info(" • references")

    if await db.otus.count() and not await db.references.count():
        await virtool.db.references.create_original(db, settings)


async def organize_sequences(db):
    logger.info(" • sequences")

    async for document in db.sequences.find(REFERENCE_QUERY):
        document.update({
            "_id": await virtool.db.utils.get_new_id(db.sequences),
            "accession": document["_id"],
            "reference": {
                "id": "original"
            }
        })

        await db.sequences.insert_one(document)

    await db.sequences.delete_many(REFERENCE_QUERY)


async def organize_status(db, server_version):
    logger.info(" • status")

    await db.status.delete_many({
        "_id": {
            "$in": ["software_update", "version"]
        }
    })

    await db.status.update_one({"_id": "software"}, {
        "$set": {
            "process": None,
            "version": server_version
        }
    }, upsert=True)

    try:
        await db.status.insert_one({
            "_id": "hmm",
            "installed": None,
            "process": None,
            "updates": list(),
            "release": None
        })
    except pymongo.errors.DuplicateKeyError:
        pass


async def organize_subtraction(db):
    logger.info(" • subtraction")

    await delete_unready(db.subtraction)


async def organize_users(db):
    logger.info(" • users")

    async for document in db.users.find({"groups": "administrator"}):
        await db.users.update_one({"_id": document["_id"]}, {
            "$set": {
                "administrator": True
            },
            "$pull": {
                "groups": "administrator"
            }
        })
