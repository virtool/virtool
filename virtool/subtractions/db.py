"""Work with subtractions in the database."""

import asyncio
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

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
    """Build a subtraction document from Postgres rows.

    The returned document's ``id`` is the integer primary key, and the ``file``,
    ``job``, ``upload``, and ``user`` fields carry the reference shapes the
    ``AttachUploadTransform``, ``AttachJobTransform``, and ``AttachUserTransform``
    expect. Because ``id`` is already the public identifier, the downstream
    ``base_processor`` call is a harmless no-op for the id.

    Postgres does not store the ``file`` snapshot, so it is rebuilt from the joined
    upload row, which is the same upload the subtraction was created against.
    """
    return {
        "id": subtraction.id,
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
                SQLSubtraction.id.in_(document["subtractions"]),
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
                    SQLSubtraction.id.in_(subtraction_ids),
                ),
            )

            lookup = _subtraction_lookup(result.scalars().all())
        else:
            lookup = {}

        return {d["id"]: [lookup[s] for s in d["subtractions"]] for d in documents}


def _subtraction_lookup(
    subtractions: list[SQLSubtraction],
) -> dict[int, dict]:
    """Build a lookup of subtraction reference shapes keyed by the integer
    subtraction id.

    The returned ``{"id", "name"}`` shape is the reference shape referrers expect.
    """
    return {s.id: {"id": s.id, "name": s.name} for s in subtractions}


async def get_missing_subtraction_ids(
    pg: AsyncEngine,
    subtraction_ids: list[int],
) -> set[int]:
    """Return the subset of ``subtraction_ids`` that do not exist in Postgres.

    Resolves ids by integer id only, returning the offending input ids so callers
    can format errors.
    """
    if not subtraction_ids:
        return set()

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLSubtraction.id).where(
                SQLSubtraction.id.in_(subtraction_ids),
                SQLSubtraction.deleted.is_(False),
            ),
        )

        rows = result.all()

    existing = {id_ for (id_,) in rows}

    return set(subtraction_ids) - existing


async def attach_computed(
    mongo: "Mongo",
    pg: AsyncEngine,
    base_url: str,
    subtraction_pk: int,
    subtraction: dict[str, Any],
) -> dict[str, Any]:
    """Attach the ``linked_samples`` and ``files`` fields to the passed subtraction
    document.

    Queries MongoDB and SQL to find the required data. Returns a new document
    dictionary.

    :param mongo: the application MongoDB database
    :param pg: the application Postgres engine
    :param base_url: the base URL the API is being served from
    :param subtraction_pk: the integer id keying the ``subtraction_files`` rows
    :param subtraction: the subtraction document to attach to
    :return: a new subtraction document with new fields attached

    """
    files, linked_samples = await asyncio.gather(
        get_subtraction_files(pg, subtraction_pk),
        get_linked_samples(mongo, subtraction_pk),
    )

    for file in files:
        file["subtraction"] = subtraction_pk
        file["download_url"] = (
            f"{base_url}/subtractions/{subtraction_pk}/files/{file['name']}"
        )

    return {**subtraction, "files": files, "linked_samples": linked_samples}


async def get_linked_samples(mongo: "Mongo", subtraction_id: int) -> list[dict]:
    """Find all samples containing given 'subtraction_id' in 'subtractions' field.

    :param mongo: the application database client
    :param subtraction_id: the integer ID of the subtraction
    :return: a list of dicts containing linked samples with 'id' and 'name' field.

    """
    return [
        base_processor(d)
        async for d in mongo.samples.find(
            {"subtractions": subtraction_id},
            ["_id", "name"],
        )
    ]
