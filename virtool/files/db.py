"""
Work with uploaded files in the database.

Schema:
- _id (str) unique ID for the file - ID = unique prefix + file name
- name (str) name of the uploaded file
- ready (bool) true when the file is ready to be used
- reserved (bool) true if the file has been reserved by a workflow and shouldn't be shown to users
- size (int) the size of the file on disk in bytes
- type (Enum["reads", "sample_replacement", "subtraction"]) the type of file
- uploaded_at (datetime) when the file upload completed
- user (Object) described the uploading user
  - id (str) the ID of the user

"""
import logging
import os
import pathlib
from typing import Union

import arrow
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import virtool.db.core
import virtool.db.utils
import virtool.files.utils
import virtool.tasks.task
import virtool.types
import virtool.utils

from virtool.uploads.models import Upload

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


class MigrateFilesTask(virtool.tasks.task.Task):

    def __init__(self, app: virtool.types.App, task_id: str):
        super().__init__(app, task_id)

        self.steps = [
            self.transform_documents_to_rows
        ]

    async def transform_documents_to_rows(self):
        """
        Transforms documents in the `files` collection into rows in the `uploads` SQL table.

        """
        async for document in self.db.files.find():
            async with AsyncSession(self.app["pg"]) as session:
                exists = (await session.execute(select(Upload).filter_by(name_on_disk=document["_id"]))).scalar()

                if not exists:
                    upload = Upload(
                        name=document["name"],
                        name_on_disk=document["_id"],
                        ready=document["ready"],
                        removed=False,
                        reserved=document["reserved"],
                        size=document["size"],
                        type=document["type"],
                        user=document["user"]["id"],
                        uploaded_at=document["uploaded_at"]
                    )

                    session.add(upload)
                    await session.commit()

                    await self.db.files.delete_one({"_id": document["_id"]})


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


async def clean(app: virtool.types.App):
    db = app["db"]

    files_path = pathlib.Path(app["settings"]["data_path"]) / "files"
    dir_list = os.listdir(files_path)
    db_list = await db.files.distinct("_id")

    for filename in dir_list:
        if filename not in db_list:
            await app["run_in_thread"](
                os.remove,
                os.path.join(files_path, filename)
            )

    db_created_list = await db.files.find({"created": True}).distinct("_id")

    await db.files.delete_many({
        "_id": {
            "$in": [filename for filename in db_created_list if filename not in dir_list]
        }
    })
