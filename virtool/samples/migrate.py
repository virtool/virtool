import os
import re

import pymongo

import virtool.samples.db
import virtool.utils

LIBRARY_TYPE_QUERY = {
    "library_type": {
        "$exists": False
    }
}


PAIRED_QUERY = {
   "paired": {
       "$exists": False
   }
}

RE_FILE_PREFIX = re.compile("^[0-9a-z]{8}-")


async def migrate_samples(app):
    motor_client = app["db"].motor_client

    await update_ready(motor_client)
    await update_pairedness(motor_client)
    await prune_fields(motor_client)
    await add_library_type(motor_client)

    for sample_id in await motor_client.samples.distinct("_id"):
        await virtool.samples.db.recalculate_algorithm_tags(motor_client, sample_id)


async def add_library_type(db):
    """
    Add a `library_type` field that is calculated from the `srna` field of each sample document.

    If the `srna` field is not defined `library_type` is set to normal.

    """
    if await db.samples.count(LIBRARY_TYPE_QUERY):
        updates = list()

        async for document in db.samples.find(LIBRARY_TYPE_QUERY, ["_id", "srna"]):
            update = pymongo.UpdateOne({"_id": document["_id"]}, {
                "$set": {
                    "library_type": "srna" if document.get("srna") else "normal"
                },
                "$unset": {
                    "srna": ""
                }
            })

            updates.append(update)

        await db.samples.bulk_write(updates)

    await db.samples.update_many({}, {
        "$unset": {
            "srna": ""
        }
    })


async def update_file_representation(app):
    motor_client = app["db"].motor_client
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


async def prune_fields(db):
    await db.samples.update_many({}, {
        "$unset": {
            "imported": "",
            "archived": "",
            "analyzed": ""
        }
    })


async def update_pairedness(db):
    """
    If a sample doesn't have a `paired` field, derive it based on the length of the `files` list and add a `paired`
    field to the document.

    :param db: a DB client object

    """
    await db.samples.update_many({**PAIRED_QUERY, "files": {"$size": 1}}, {
        "$set": {
            "paired": False
        }
    })

    await db.samples.update_many({**PAIRED_QUERY, "files": {"$size": 2}}, {
        "$set": {
            "paired": True
        }
    })


async def update_ready(db):
    await db.samples.delete_many({
        "$or": [
            {"imported": "ip"},
            {"ready": False}
        ]
    })

    await db.samples.update_many({}, {
        "$set": {
            "ready": True
        }
    })
