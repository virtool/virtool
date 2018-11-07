import logging
import os
import shutil

import dictdiffer
import pymongo.errors
from pymongo import UpdateOne

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


async def join_legacy_virus(db, virus_id):
    """
    Join the otu associated with the supplied ``virus_id`` with its sequences. If a otu entry is also passed,
    the database will not be queried for the otu based on its id.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param virus_id: the id of the virus to join
    :type virus_id: str

    :return: the joined otu document
    :rtype: Coroutine[dict]

    """
    # Get the otu entry if a ``document`` parameter was not passed.
    document = await db.otus.find_one(virus_id)

    if document is None:
        return None

    cursor = db.sequences.find({"virus_id": document["_id"]})

    # Merge the sequence entries into the otu entry.
    return virtool.otus.merge_otu(document, [d async for d in cursor])


async def organize(db, settings, server_version):
    await organize_files(db)
    await organize_otus(db)
    await organize_history(db)
    await organize_indexes(db)
    await organize_users(db)
    await organize_groups(db)
    await organize_references(db, settings)
    await organize_sequences(db)
    await organize_analyses(db)
    await organize_status(db, server_version)
    await organize_subtraction(db)
    await organize_samples(db)
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

    motor_client = db.motor_client

    await delete_unready(motor_client.analyses)
    await add_original_reference(motor_client.analyses)

    if await motor_client.analyses.count({"diagnosis.virus": {"$exists": True}}):
        async for document in motor_client.references.find({}, ["name"]):
            query = {
                "reference.id": document["_id"],
                "reference.name": {
                    "$ne": document["name"]
                }
            }

            await motor_client.analyses.update_many(query, {
                "$set": {
                    "reference.name": document["name"]
                }
            })

        query = {
            "algorithm": "pathoscope_bowtie",
            "diagnosis.virus": {
                "$exists": True
            }
        }

        buffer = list()

        async for document in motor_client.analyses.find(query, ["diagnosis"]):
            diagnosis = document["diagnosis"]

            for hit in diagnosis:
                hit["otu"] = hit.pop("virus")

            op = UpdateOne({"_id": document["_id"]}, {
                "$set": {
                    "diagnosis": diagnosis
                }
            })

            buffer.append(op)

            if len(buffer) == 40:
                await db.motor_client.analyses.bulk_write(buffer)
                buffer = list()

        if len(buffer):
            await db.motor_client.analyses.bulk_write(buffer)


async def organize_files(db):
    logger.info(" • files")

    await db.files.update_many({}, {
        "$set": {
            "reserved": False
        }
    }, silent=True)


async def organize_groups(db):
    logger.info(" • groups")

    await db.groups.delete_one({"_id": "administrator"})

    async for group in db.groups.find():
        await db.groups.update_one({"_id": group["_id"]}, {
            "$set": {
                "permissions": {perm: group["permissions"].get(perm, False) for perm in virtool.users.PERMISSIONS}
            }
        }, silent=True)


async def organize_history(db):
    logger.info(" • history")

    motor_client = db.motor_client

    if await motor_client.analyses.count({"reference": {"$exists": False}}):
        await motor_client.history.update_many({"virus": {"$exists": True}}, {
            "$rename": {
                "virus": "otu"
            },
            "$set": {
                "reference": {
                    "id": "original"
                }
            }
        })

        # Get all OTU ids that have ever existed.
        historical_otu_ids = await db.history.distinct("otu.id")

        for otu_id in historical_otu_ids:

            versions = list()

            patched = await join_legacy_virus(db, otu_id) or dict()

            first_version = patched.get("version", None)

            versions.append(patched or None)

            async for change in db.history.find({"otu.id": otu_id}, sort=[("otu.version", -1)]):
                if first_version is not None and change["otu"]["version"] == first_version:
                    continue

                elif change["method_name"] == "remove":
                    patched = change["diff"]
                    versions.append(patched)

                elif change["method_name"] == "create":
                    patched = change["diff"]
                    versions.append(patched)

                else:
                    patched = dictdiffer.revert(change["diff"], patched)
                    versions.append(patched)

            versions.reverse()

            versions = [revise_otu(otu) for otu in versions]

            previous = versions[0]

            updates = list()

            for otu in versions:
                if otu is None:
                    change_id = "{}.removed".format(otu_id)

                    updates.append(UpdateOne({"_id": change_id}, {
                        "$set": {
                            "diff": previous
                        }
                    }))

                    break

                change_id = "{}.{}".format(otu_id, otu["version"])

                if otu["version"] == 0:
                    updates.append(UpdateOne({"_id": change_id}, {
                        "$set": {
                            "diff": previous
                        }
                    }))

                    continue

                diff = list(dictdiffer.diff(previous, otu))

                updates.append(UpdateOne({"_id": change_id}, {
                    "$set": {
                        "diff": diff
                    }

                }))

            await motor_client.history.bulk_write(updates)

        await add_original_reference(db.motor_client.otus)


async def organize_indexes(db):
    logger.info(" • indexes")

    await add_original_reference(db.motor_client.indexes)


async def organize_otus(db):
    logger.info(" • otus")

    if "otus" in await db.collection_names():
        return

    if "viruses" in await db.collection_names():
        await db.viruses.rename("otus")

    if "kinds" in await db.collection_names():
        await db.kinds.rename("otus")


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
        await virtool.db.references.create_original(db.motor_client, settings)


async def organize_samples(db):
    motor_client = db.motor_client

    for sample_id in await motor_client.samples.distinct("_id"):
        await virtool.db.samples.recalculate_algorithm_tags(motor_client, sample_id)


async def organize_sequences(db):
    logger.info(" • sequences")

    motor_client = db.motor_client

    buffer = list()

    async for document in motor_client.sequences.find(REFERENCE_QUERY, ["virus_id"]):

        otu_id = document.pop("virus_id")

        op = UpdateOne({"_id": document["_id"]}, {
            "$set": {
                "accession": document["_id"],
                "otu_id": otu_id,
                "reference": {
                    "id": "original"
                }
            },
            "$unset": {
                "virus_id": ""
            }
        })

        buffer.append(op)

        if len(buffer) == 50:
            await motor_client.sequences.bulk_write(buffer)
            buffer = list()

    if len(buffer):
        await motor_client.sequences.bulk_write(buffer)


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


async def organize_users(db):
    logger.info(" • users")

    async for document in db.users.find({"administrator": {"$exists": False}}, ["groups"]):
        await db.users.update_one({"_id": document["_id"]}, {
            "$set": {
                "administrator": "administrator" in document["groups"]
            },
            "$pull": {
                "groups": "administrator"
            }
        }, silent=True)


def revise_otu(otu):
    if otu is None:
        return None

    reference = {
        "id": "original"
    }

    otu["reference"] = reference

    for isolate in otu["isolates"]:
        for sequence in isolate["sequences"]:
            sequence["accession"] = sequence["_id"]
            sequence["reference"] = reference
            sequence["otu_id"] = sequence.pop("virus_id")

    return otu
