"""
Work with subtractions in the database.

"""
import asyncio
import glob
import shutil
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncEngine

import virtool.db.utils
import virtool.utils
from virtool.config.cls import Config
from virtool.db.transforms import AbstractTransform
from virtool.db.utils import get_one_field
from virtool.subtractions.utils import get_subtraction_files, join_subtraction_path
from virtool.types import App, Document

PROJECTION = [
    "_id",
    "count",
    "created_at",
    "file",
    "ready",
    "job",
    "name",
    "nickname",
    "user",
    "has_file",
]

ADD_SUBTRACTION_FILES_QUERY = {"deleted": False}


class AttachSubtractionTransform(AbstractTransform):
    """
    Attach more subtraction detail to a document with a field `subtractions` that
    contains a list    of subtraction IDs.
    """

    def __init__(self, db):
        self._db = db

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "subtractions": prepared}

    async def prepare_one(self, document: Document) -> Any:
        return [
            {
                "id": subtraction_id,
                "name": await get_one_field(
                    self._db.subtraction, "name", subtraction_id
                ),
            }
            for subtraction_id in document["subtractions"]
        ]


async def attach_computed(app: App, subtraction: Dict[str, Any]) -> Dict[str, Any]:
    """
    Attach the ``linked_samples`` and ``files`` fields to the passed subtraction document.

    Queries MongoDB and SQL to find the required data. Returns a new document dictionary.

    :param app: the application object
    :param subtraction: the subtraction document to attach to
    :return: a new subtraction document with new fields attached

    """
    subtraction_id = subtraction["_id"]

    files, linked_samples = await asyncio.gather(
        get_subtraction_files(app["pg"], subtraction_id),
        virtool.subtractions.db.get_linked_samples(app["db"], subtraction_id),
    )

    base_url = app["config"].base_url

    for file in files:
        file[
            "download_url"
        ] = f"{base_url}/subtractions/{subtraction_id}/files/{file['name']}"

    return {**subtraction, "files": files, "linked_samples": linked_samples}


async def check_subtraction_fasta_files(db, config: Config) -> list:
    """
    Check subtraction directories for files and set 'has_file' to boolean based on whether .fa.gz
    exists.

    :param db: the application database client
    :param config: the application configuration
    :return: a list of subtraction IDs without FASTA files

    """
    subtractions_without_fasta = list()

    async for subtraction in db.subtraction.find({"deleted": False}):
        path = join_subtraction_path(config, subtraction["_id"])
        has_file = True

        if not glob.glob(f"{path}/*.fa.gz"):
            has_file = False
            subtractions_without_fasta.append(subtraction["_id"])

        await db.subtraction.find_one_and_update(
            {"_id": subtraction["_id"]}, {"$set": {"has_file": has_file}}
        )

    return subtractions_without_fasta


async def create(
    db,
    user_id: str,
    filename: str,
    name: str,
    nickname: str,
    upload_id: int,
    subtraction_id: Optional[str] = None,
) -> dict:
    """
    Create a new subtraction document.

    :param db: the application database client
    :param user_id: the id of the current user
    :param filename: the name of the `subtraction_file`
    :param name: the name of the subtraction
    :param nickname: the nickname of the subtraction
    :param upload_id: the id of the `subtraction_file`
    :param subtraction_id: the id of the subtraction

    :return: the new document

    """
    document = {
        "_id": subtraction_id or await virtool.db.utils.get_new_id(db.subtraction),
        "name": name,
        "nickname": nickname,
        "deleted": False,
        "ready": False,
        "file": {"id": upload_id, "name": filename},
        "user": {"id": user_id},
        "created_at": virtool.utils.timestamp(),
    }

    await db.subtraction.insert_one(document)

    return document


async def delete(app: App, subtraction_id: str) -> int:
    db = app["db"]
    config = app["config"]

    update_result = await db.subtraction.update_one(
        {"_id": subtraction_id, "deleted": False}, {"$set": {"deleted": True}}
    )

    await unlink_default_subtractions(db, subtraction_id)

    if update_result.modified_count:
        path = join_subtraction_path(config, subtraction_id)
        await app["run_in_thread"](shutil.rmtree, path, True)

    return update_result.modified_count


async def finalize(
    db,
    pg: AsyncEngine,
    subtraction_id: str,
    gc: Dict[str, float],
    count: int,
) -> dict:
    """
    Finalize a subtraction by setting `ready` to True and updating the `gc` and `files` fields.

    :param db: the application database client
    :param pg: the PostgreSQL AsyncEngine object
    :param subtraction_id: the id of the subtraction
    :param gc: a dict contains gc data
    :return: the updated subtraction document

    """
    updated_document = await db.subtraction.find_one_and_update(
        {"_id": subtraction_id},
        {
            "$set": {
                "gc": gc,
                "ready": True,
                "count": count,
            }
        },
    )

    return updated_document


async def get_linked_samples(db, subtraction_id: str) -> List[dict]:
    """
    Find all samples containing given 'subtraction_id' in 'subtractions' field.

    :param db: the application database client
    :param subtraction_id: the ID of the subtraction
    :return: a list of dicts containing linked samples with 'id' and 'name' field.

    """
    cursor = db.samples.find({"subtractions": subtraction_id}, ["_id", "name"])
    return [virtool.utils.base_processor(d) async for d in cursor]


async def unlink_default_subtractions(db, subtraction_id: str):
    await db.samples.update_many(
        {"subtractions": subtraction_id}, {"$pull": {"subtractions": subtraction_id}}
    )
