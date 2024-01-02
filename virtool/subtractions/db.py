"""
Work with subtractions in the database.

"""
from __future__ import annotations

import asyncio
import glob
from typing import Any, TYPE_CHECKING

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.config.cls import Config
from virtool.data.transforms import AbstractTransform
from virtool.mongo.utils import get_one_field
from virtool.subtractions.utils import get_subtraction_files, join_subtraction_path
from virtool.types import Document
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo

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


class AttachSubtractionsTransform(AbstractTransform):
    """
    Attach more subtraction detail to a document with a field `subtractions` that
    contains a list of subtraction IDs.
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

    async def prepare_many(self, documents: list[Document]) -> dict[str, list[dict]]:
        subtraction_ids = {s for d in documents for s in d["subtractions"]}

        subtraction_lookup = {
            d["_id"]: {"id": d["_id"], "name": d["name"]}
            async for d in self._db.subtraction.find(
                {"_id": {"$in": list(subtraction_ids)}}, ["_id", "name"]
            )
        }

        return {
            d["id"]: [subtraction_lookup[s] for s in d["subtractions"]]
            for d in documents
        }


async def attach_computed(
    mongo, pg: AsyncEngine, base_url: str, subtraction: dict[str, Any]
) -> dict[str, Any]:
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
        get_linked_samples(mongo, subtraction_id),
    )

    for file in files:
        file[
            "download_url"
        ] = f"{base_url}/subtractions/{subtraction_id}/files/{file['name']}"

    return {**subtraction, "files": files, "linked_samples": linked_samples}


async def check_subtraction_fasta_files(mongo: Mongo, config: Config) -> list:
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


async def get_linked_samples(mongo: Mongo, subtraction_id: str) -> list[dict]:
    """
    Find all samples containing given 'subtraction_id' in 'subtractions' field.

    :param mongo: the application database client
    :param subtraction_id: the ID of the subtraction
    :return: a list of dicts containing linked samples with 'id' and 'name' field.

    """
    return [
        base_processor(d)
        async for d in mongo.samples.find(
            {"subtractions": subtraction_id}, ["_id", "name"]
        )
    ]


async def unlink_default_subtractions(
    mongo: Mongo, subtraction_id: str, session: AsyncIOMotorClientSession
):
    """
    Remove a subtraction as a default subtraction for samples.

    :param mongo: the application mongo object
    :param subtraction_id: the id of the subtraction to remove
    :param session: a motor session to use
    """
    await mongo.samples.update_many(
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
                    {"$sort": {"_id": 1}},
                    {"$project": {"id": "$_id", "_id": False, "name": True}},
                ],
                "as": set_as,
            }
        },
    ]


async def get_subtraction_names(
    mongo: Mongo, subtraction_ids: list[str]
) -> list[dict[str, str]]:
    """
    Retrieve a list of subtraction names and ids.

    :param mongo: the application database client
    :param subtraction_ids: list containing subtraction ids
    :return: list of dictionaries containing {"_id": sub_id, "name": sub_name}
    """
    subtractions = await mongo.subtraction.find(
        {"_id": {"$in": subtraction_ids}}, projection=["_id", "name"]
    ).to_list(length=len(subtraction_ids))

    return subtractions
