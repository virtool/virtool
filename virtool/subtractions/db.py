"""Work with subtractions in the database."""

import asyncio
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.subtractions.pg import SQLSubtraction
from virtool.subtractions.utils import get_subtraction_files
from virtool.types import Document
from virtool.uploads.sql import SQLUpload
from virtool.utils import base_processor


def map_subtraction_row(
    subtraction: SQLSubtraction,
    upload: SQLUpload | None,
) -> Document:
    """Build a legacy-shaped subtraction document from Postgres rows.

    The returned document mirrors the Mongo document shape that
    :func:`attach_computed` and the subtraction transforms consume: ``_id`` is the
    legacy slug, and the ``file``, ``job``, ``upload``, and ``user`` fields carry
    the reference shapes the ``AttachUploadTransform``, ``AttachJobTransform``, and
    ``AttachUserTransform`` expect.

    Postgres does not store the ``file`` snapshot, so it is rebuilt from the joined
    upload row, which is the same upload the subtraction was created against.
    """
    return {
        "_id": subtraction.legacy_id,
        "count": subtraction.count,
        "created_at": subtraction.created_at,
        "file": {"id": upload.id, "name": upload.name} if upload else None,
        "gc": subtraction.gc,
        "job": {"id": subtraction.job_id} if subtraction.job_id is not None else None,
        "name": subtraction.name,
        "nickname": subtraction.nickname,
        "ready": subtraction.ready,
        "upload": subtraction.upload_id,
        "user": {"id": subtraction.user_id}
        if subtraction.user_id is not None
        else None,
    }


def subtraction_processor(document: Document) -> Document:
    """Process a subtraction document for client-side.

    :param document: the subtraction document to process
    :return: the processed document
    """
    return {**base_processor(document), "subtractions": document["subtractions"] or []}


class AttachSubtractionsTransform(AbstractTransform):
    """Attach more subtraction detail to a document with a field `subtractions` that
    contains a list of subtraction IDs.
    """

    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "subtractions": sorted(prepared, key=lambda x: x["name"])}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        return [
            {
                "id": subtraction_id,
                "name": await get_one_field(
                    self._mongo.subtraction,
                    "name",
                    subtraction_id,
                ),
            }
            for subtraction_id in document["subtractions"]
        ]

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> dict[str, list[dict]]:
        subtraction_ids = {s for d in documents for s in d["subtractions"]}

        subtraction_lookup = {
            d["_id"]: {"id": d["_id"], "name": d["name"]}
            async for d in self._mongo.subtraction.find(
                {"_id": {"$in": list(subtraction_ids)}},
                ["_id", "name"],
            )
        }

        return {
            d["id"]: [subtraction_lookup[s] for s in d["subtractions"]]
            for d in documents
        }


async def attach_computed(
    mongo: "Mongo",
    pg: AsyncEngine,
    base_url: str,
    subtraction: dict[str, Any],
) -> dict[str, Any]:
    """Attach the ``linked_samples`` and ``files`` fields to the passed subtraction
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
        file["download_url"] = (
            f"{base_url}/subtractions/{subtraction_id}/files/{file['name']}"
        )

    return {**subtraction, "files": files, "linked_samples": linked_samples}


async def get_linked_samples(mongo: "Mongo", subtraction_id: str) -> list[dict]:
    """Find all samples containing given 'subtraction_id' in 'subtractions' field.

    :param mongo: the application database client
    :param subtraction_id: the ID of the subtraction
    :return: a list of dicts containing linked samples with 'id' and 'name' field.

    """
    return [
        base_processor(d)
        async for d in mongo.samples.find(
            {"subtractions": subtraction_id},
            ["_id", "name"],
        )
    ]


async def unlink_default_subtractions(
    mongo: "Mongo",
    subtraction_id: str,
    session: AsyncIOMotorClientSession,
) -> None:
    """Remove a subtraction as a default subtraction for samples.

    :param mongo: the application mongo object
    :param subtraction_id: the id of the subtraction to remove
    :param session: a motor session to use
    """
    await mongo.samples.update_many(
        {"subtractions": subtraction_id},
        {"$pull": {"subtractions": subtraction_id}},
        session=session,
    )
