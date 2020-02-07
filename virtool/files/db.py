import logging
from typing import Union

import arrow

import virtool.db.core
import virtool.db.utils
import virtool.files.utils
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


async def generate_file_id(db, filename: str) -> str:
    """
    Generate a unique id for a new file. File ids comprise a unique prefix joined to the filename by a dash
    (eg. abc123-reads.fq.gz).

    :param db: the application database object
    :param filename: the filename to generate an id with
    :return: the file id

    """
    prefix = await virtool.db.utils.get_new_id(db.files)
    file_id = f"{prefix}-{filename}"

    if await db.files.count_documents({"_id": file_id}):
        return await generate_file_id(db, filename)

    return file_id


async def create(db, filename: str, file_type: str, reserved: bool = False, user_id: Union[None, str] = None):
    """
    Create a new file document.

    :param db: the application database object
    :param filename: the name of the file
    :param file_type: the type if file (eg. reads)
    :param reserved: should the file immediately be reserved (used for updating legacy samples)
    :param user_id: the id of the uploading user
    :return: the file document

    """
    file_id = await generate_file_id(db, filename)

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
        "reserved": reserved,
        "ready": False
    }

    await db.files.insert_one(document)

    # Return document will all keys, but size.
    document = {key: document[key] for key in [key for key in PROJECTION if key != "size"]}

    return virtool.utils.base_processor(document)


async def remove(db, settings: dict, run_in_thread: callable, file_id: str):
    """
    Remove the file with `file_id` from the database and disk. Return the deleted file count.

    :param db: the application database object
    :param settings: the application settings
    :param run_in_thread: the application thread running function
    :param file_id: the file id to remove
    :return: the number of deleted files

    """
    delete_result = await db.files.delete_one({"_id": file_id})

    path = virtool.files.utils.join_file_path(settings, file_id)

    try:
        await run_in_thread(virtool.utils.rm, path)
    except FileNotFoundError:
        pass

    return delete_result.deleted_count


async def reserve(db, file_ids: list):
    """
    Reserve the files identified in `file_ids` by setting the `reserved` field to `True`.

    :param db: the application database object
    :param file_ids: a list of file_ids to reserve

    """
    await db.files.update_many({"_id": {"$in": file_ids}}, {
        "$set": {
            "reserved": True
        }
    })
