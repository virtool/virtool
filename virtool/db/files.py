import asyncio
import logging
import os

import arrow

import virtool.db.utils
import virtool.utils

logger = logging.getLogger(__name__)

PROJECTION = [
    "_id",
    "name",
    "size",
    "user",
    "uploaded_at",
    "type",
    "ready",
    "reserved"
]


async def create(db, filename, file_type, user_id=None):
    file_id = None

    while file_id is None or file_id in await db.files.distinct("_id"):
        prefix = await virtool.db.utils.get_new_id(db.files)
        file_id = f"{prefix}-{filename}"

    uploaded_at = virtool.utils.timestamp()

    expires_at = None

    if file_type == "otus":
        expires_at = arrow.get(uploaded_at).shift(hours=+5).datetime

    user = None

    if user_id is not None:
        user = {
            "id": user_id
        }

    document = {
        "_id": file_id,
        "name": filename,
        "type": file_type,
        "user": user,
        "uploaded_at": uploaded_at,
        "expires_at": expires_at,
        "created": False,
        "reserved": False,
        "ready": False
    }

    await db.files.insert_one(document)

    # Return document will all keys, but size.
    document = {key: document[key] for key in [key for key in PROJECTION if key != "size"]}

    return virtool.utils.base_processor(document)


async def reserve(db, file_ids):
    await db.files.update_many({"_id": {"$in": file_ids}}, {
        "$set": {
            "reserved": True
        }
    })


async def release_reservations(db, file_ids):
    await db.files.update_many({"_id": {"$in": file_ids}}, {
        "$set": {
            "reserve": False
        }
    })


async def remove(loop, db, settings, file_id):
    await db.files.delete_one({"_id": file_id})

    file_path = os.path.join(settings["data_path"], "files", file_id)

    loop = asyncio.get_event_loop()

    await loop.run_in_executor(None, virtool.utils.rm, file_path)
