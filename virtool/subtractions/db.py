"""Work with subtractions in the database."""

import asyncio
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import compose_legacy_id_multi_expression
from virtool.data.transforms import AbstractTransform
from virtool.mongo.core import Mongo
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

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "subtractions": sorted(prepared, key=lambda x: x["name"])}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        if not document["subtractions"]:
            return []

        result = await session.execute(
            select(SQLSubtraction).where(
                compose_legacy_id_multi_expression(
                    SQLSubtraction, document["subtractions"]
                ),
            ),
        )

        lookup = _subtraction_lookup(result.scalars().all())

        return [lookup[s] for s in document["subtractions"]]

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> dict[str, list[dict]]:
        subtraction_ids = {s for d in documents for s in d["subtractions"]}

        if subtraction_ids:
            result = await session.execute(
                select(SQLSubtraction).where(
                    compose_legacy_id_multi_expression(SQLSubtraction, subtraction_ids),
                ),
            )

            lookup = _subtraction_lookup(result.scalars().all())
        else:
            lookup = {}

        return {d["id"]: [lookup[s] for s in d["subtractions"]] for d in documents}


def _subtraction_lookup(
    subtractions: list[SQLSubtraction],
) -> dict[int | str, dict]:
    """Build a lookup of subtraction reference shapes keyed by both modern integer
    id and legacy string id.

    Referrers are still string-keyed during the migration, so a referrer that holds
    a legacy id resolves via ``legacy_id`` while a modern integer id resolves via
    ``id``. The returned ``{"id", "name"}`` shape mirrors the legacy Mongo output.
    """
    return {
        **{s.id: {"id": s.id, "name": s.name} for s in subtractions},
        **{
            s.legacy_id: {"id": s.legacy_id, "name": s.name}
            for s in subtractions
            if s.legacy_id is not None
        },
    }


async def get_missing_subtraction_ids(
    pg: AsyncEngine,
    subtraction_ids: list[str | int],
) -> set[str | int]:
    """Return the subset of ``subtraction_ids`` that do not exist in Postgres.

    Resolves ids by both legacy string id and modern integer id, returning the
    offending input ids unchanged so callers can format errors as before.
    """
    if not subtraction_ids:
        return set()

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLSubtraction.id, SQLSubtraction.legacy_id).where(
                compose_legacy_id_multi_expression(SQLSubtraction, subtraction_ids),
            ),
        )

    existing: set[str | int] = set()

    for id_, legacy_id in result.all():
        existing |= {id_, str(id_), legacy_id}

    return set(subtraction_ids) - existing


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
