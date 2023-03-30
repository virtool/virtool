"""
Work with subtractions in the database.

"""
import asyncio
import glob
import math
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy.ext.asyncio import AsyncEngine
from virtool_core.models.subtraction import Subtraction
from virtool.data.errors import ResourceNotFoundError

import virtool.utils
from virtool.config.cls import Config
from virtool.mongo.transforms import AbstractTransform, apply_transforms
from virtool.mongo.utils import get_one_field
from virtool.subtractions.utils import get_subtraction_files, join_subtraction_path
from virtool.types import Document
from virtool.uploads.db import AttachUploadTransform
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor

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


async def attach_computed(
    mongo, pg: AsyncEngine, base_url: str, subtraction: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Attach the ``linked_samples`` and ``files`` fields to the passed subtraction
    document.

    Queries MongoDB and SQL to find the required data. Returns a new document
    dictionary.

    :param mongo: the application MongoDB database
    :param pg: the application Postgres engine
    :param base_url: the base URL the API is being served from
    :param subtraction: the subtraction document to attach to
    :return: a new subtraction document with new fields attached

    """
    subtraction_id = subtraction["_id"]

    files, linked_samples = await asyncio.gather(
        get_subtraction_files(pg, subtraction_id),
        virtool.subtractions.db.get_linked_samples(mongo, subtraction_id),
    )

    for file in files:
        file[
            "download_url"
        ] = f"{base_url}/subtractions/{subtraction_id}/files/{file['name']}"

    return {**subtraction, "files": files, "linked_samples": linked_samples}


async def fetch_complete_subtraction(
    mongo, pg: AsyncEngine, base_url: str, subtraction_id: str
) -> Optional[Subtraction]:
    document = await mongo.subtraction.find_one({"_id": subtraction_id})

    if document:
        document = await attach_computed(mongo, pg, base_url, document)

        return await apply_transforms(
            base_processor(document),
            [
                AttachUserTransform(mongo, ignore_errors=True),
                AttachUploadTransform(pg),
            ],
        )


async def check_subtraction_fasta_files(mongo, config: Config) -> list:
    """
    Check subtraction directories for files

    :param mongo: the application database client
    :param config: the application configuration
    :return: a list of subtraction IDs without FASTA files

    """
    subtractions_without_fasta = []

    async for subtraction in mongo.subtraction.find({"deleted": False}):
        path = join_subtraction_path(config, subtraction["_id"])

        if not glob.glob(f"{path}/*.fa.gz"):
            subtractions_without_fasta.append(subtraction["_id"])

    return subtractions_without_fasta


async def get_linked_samples(db, subtraction_id: str) -> List[dict]:
    """
    Find all samples containing given 'subtraction_id' in 'subtractions' field.

    :param db: the application database client
    :param subtraction_id: the ID of the subtraction
    :return: a list of dicts containing linked samples with 'id' and 'name' field.

    """
    cursor = db.samples.find({"subtractions": subtraction_id}, ["_id", "name"])
    return [virtool.utils.base_processor(d) async for d in cursor]


async def unlink_default_subtractions(
    db, subtraction_id: str, session: AsyncIOMotorClientSession
):
    """
    Remove a subtraction as a default subtraction for samples.

    :param db: the application mongo object
    :param subtraction_id: the id of the subtraction to remove
    :param session: a motor session to use
    """
    await db.samples.update_many(
        {"subtractions": subtraction_id},
        {"$pull": {"subtractions": subtraction_id}},
        session=session,
    )


def lookup_nested_subtractions(
    local_field: str = "subtractions", set_as: str = "subtractions"
) -> list[dict]:
    """
    Create a mongoDB aggregation pipeline step to look up nested subtractions.

    :param local_field: subtractions field to look up
    :param set_as: desired name of the returned record
    :return: mongoDB aggregation steps for use in an aggregation pipeline
    """
    return [
        {
            "$lookup": {
                "from": "subtraction",
                "let": {"subtraction_ids": f"${local_field}"},
                "pipeline": [
                    {"$match": {"$expr": {"$in": ["$_id", "$$subtraction_ids"]}}},
                    {"$project": {"id": "$_id", "_id": False, "name": True}},
                ],
                "as": set_as,
            }
        },
    ]


def subtraction_processor(data: list, query: dict) -> dict:
    try:
        data = data[0]
    except IndexError:
        raise ResourceNotFoundError()

    data["documents"] = [
            base_processor(document) for document in data["documents"]
    ]

    try:
        data["page"] = int(query["page"])
    except (KeyError, ValueError):
        data["page"] = 1

    per_page = None
    try:
        per_page = int(query["per_page"])
    except (KeyError, ValueError):
        per_page = 25
    finally:
        data["per_page"] = per_page

    data["page_count"] = int(math.ceil(data["found_count"] / per_page))

    return data
