import os
import logging

import virtool.utils

logger = logging.getLogger(__name__)


LIST_PROJECTION = [
    "_id",
    "name",
    "size",
    "user_id",
    "uploaded_at",
    "type",
    "ready"
]


def processor(document):
    return virtool.utils.base_processor(document)


async def reserve(db, file_ids):
    await db.files.update_many({"_id": {"$in": file_ids}}, {
        "$set": {
            "reserve": True
        }
    })


async def release_reservations(db, file_ids):
    await db.files.update_many({"_id": {"$in": file_ids}}, {
        "$set": {
            "reserve": False
        }
    })


async def remove(db, settings, dispatch, file_id):
    await db.files.delete_one({"_id": file_id})

    await dispatch("files", "remove", {
        "removed": [file_id]
    })

    file_path = os.path.join(settings.get("data_path"), "files", file_id)

    virtool.utils.rm(file_path)
