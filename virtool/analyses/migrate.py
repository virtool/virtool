
import json
import os
import pathlib
import re

import aiofiles
import pymongo

import virtool.analyses.utils
import virtool.api.utils
import virtool.db.core
import virtool.db.migrate

RE_JSON_FILENAME = re.compile("(pathoscope.json|nuvs.json)$")


async def migrate_analyses(app):
    """
    Delete unready analyses. Rename the `diagnosis` field in Pathoscope documents to `results`.

    This maintains consistency with NuVs documents and simplifies code reuse for processing analysis documents with
     different workflows.

    :param app: the application object

    """
    db = app["db"]
    settings = app["settings"]

    await rename_algorithm_field(db)
    await add_updated_at(db)
    await virtool.db.migrate.delete_unready(db.analyses)


async def add_updated_at(db):
    updates = list()

    async for document in db.analyses.find({"updated_at": {"$exists": False}}, ["created_at"]):
        updates.append(pymongo.UpdateOne({
            "_id": document["_id"]
        }, {
            "$set": {
                "updated_at": document["created_at"]
            }
        }))

    if updates:
        await db.analyses.bulk_write(updates)


async def rename_algorithm_field(db):
    query = virtool.api.utils.compose_exists_query("algorithm")

    await db.analyses.update_many(query, {
        "$rename": {
            "algorithm": "workflow"
        }
    })
