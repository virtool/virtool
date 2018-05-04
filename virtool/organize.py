import logging
import os
import shutil

import virtool.db.references
import virtool.db.utils
import virtool.references
import virtool.users
import virtool.utils

logger = logging.getLogger(__name__)

REF_QUERY = {
    "ref": {
        "$exists": False
    }
}


async def add_original_ref(collection):
    await collection.update_many(REF_QUERY, {
        "$set": {
            "ref": {
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
    await organize_references(db)
    await organize_groups(db)
    await organize_otus(db)
    await organize_sequences(db)
    await organize_status(db, server_version)
    await organize_subtraction(db)
    await organize_users(db)
    await organize_references(db)

    await organize_paths(db, settings)


async def organize_analyses(db):
    """
    Delete any analyses with the ``ready`` field set to ``False``.

    """
    logger.info(" • analyses")

    await delete_unready(db.analyses)
    await add_original_ref(db.analyses)


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

    document_ids = await db.history.distinct("_id", {"ref": {"$exists": False}})

    document_ids = [_id for _id in document_ids if ".removed" in _id or ".0" in _id]

    await db.history.update_many({"_id": {"$in": document_ids}}, {
        "$set": {
            "diff.ref": {
                "id": "original"
            },
            "ref": {
                "id": "original"
            }
        }
    })


async def organize_indexes(db):
    logger.info(" • indexes")

    await add_original_ref(db.indexes)


async def organize_otus(db):
    logger.info(" • otus")

    if "otus" in await db.collection_names():
        return

    if "viruses" in await db.collection_names():
        await db.viruses.rename("otus")

    if "kinds" in await db.collection_names():
        await db.kinds.rename("otus")

    await add_original_ref(db.otus)


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

            if await db.refs.count({"_id": "original"}):
                os.rename(old_indexes_path, os.path.join(references_path, "original"))

        old_subtractions_path = os.path.join(old_reference_path, "subtraction")

        if os.path.exists(old_subtractions_path):
            os.rename(old_subtractions_path, os.path.join(data_path, "subtractions"))

        shutil.rmtree(old_reference_path)


async def organize_references(db):
    logger.info(" • references")

    if await db.otus.count() and not await db.refs.count():
        await virtool.db.references.create_original(db)


async def organize_sequences(db):
    logger.info(" • sequences")

    async for document in db.sequences.find(REF_QUERY):
        document.update({
            "_id": await virtool.db.utils.get_new_id(db.sequences),
            "accession": document["_id"],
            "ref": {
                "id": "original"
            }
        })

        await db.sequences.insert_one(document)

    await db.sequences.delete_many(REF_QUERY)


async def organize_status(db, server_version):
    logger.info(" • status")

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
