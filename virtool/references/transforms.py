from typing import TYPE_CHECKING, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.pg.utils import get_row_by_id
from virtool.references.sql import SQLReference
from virtool.types import Document
from virtool.uploads.data import serialize as serialize_upload
from virtool.uploads.sql import SQLUpload
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor, get_safely

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


PROJECTION = ["_id", "name", "data_type"]


async def _resolve_legacy_reference_ids(
    session: AsyncSession,
    reference_ids: set[int | str],
) -> dict[int, str]:
    """Map the integer ``legacy_references`` primary keys in ``reference_ids`` to their
    legacy Mongo string ids.

    ``references`` are still read from Mongo (keyed by their legacy string ``_id``)
    while ``otus`` and ``sequences`` may already embed the integer primary key. This
    resolves those embedded integers back to the Mongo key. Legacy string ids need no
    resolution and are ignored.
    """
    integer_ids = {
        reference_id for reference_id in reference_ids if isinstance(reference_id, int)
    }

    if not integer_ids:
        return {}

    result = await session.execute(
        select(SQLReference.id, SQLReference.legacy_id).where(
            SQLReference.id.in_(integer_ids),
        ),
    )

    return {id_: legacy_id for id_, legacy_id in result if legacy_id is not None}


class AttachReferenceTransform(AbstractTransform):
    """Attach nested references to documents with a ``reference.id`` field.

    The embedded ``reference.id`` may be either a legacy Mongo string or the integer
    ``legacy_references`` primary key during the migration. References are still read
    from Mongo, so an integer id is resolved to its legacy string key via Postgres
    before the Mongo lookup.
    """

    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def attach_one(self, document: Document, prepared: Any) -> Document | None:
        return {**document, "reference": prepared}

    async def prepare_one(
        self, document: Document, session: AsyncSession
    ) -> Document | None:
        reference_id = get_safely(document, "reference", "id")

        if reference_id is None:
            raise ValueError("Missing reference id")

        if isinstance(reference_id, int):
            legacy_id_map = await _resolve_legacy_reference_ids(session, {reference_id})

            if reference_id not in legacy_id_map:
                raise ValueError(f"Reference {reference_id!r} not found in postgres")

            reference_id = legacy_id_map[reference_id]

        return base_processor(
            await self._mongo.references.find_one(
                {"_id": reference_id},
                PROJECTION,
            ),
        )

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, Document | None]:
        reference_ids = {get_safely(d, "reference", "id") for d in documents}
        reference_ids.discard(None)

        legacy_id_map = await _resolve_legacy_reference_ids(session, reference_ids)

        legacy_ids = {
            legacy_id_map[reference_id]
            if isinstance(reference_id, int)
            else reference_id
            for reference_id in reference_ids
        }

        reference_lookup = {
            d["_id"]: base_processor(d)
            async for d in self._mongo.references.find(
                {"_id": {"$in": list(legacy_ids)}},
                PROJECTION,
            )
        }

        reference_lookup[None] = None

        prepared: dict[str, Document | None] = {}

        for document in documents:
            reference_id = get_safely(document, "reference", "id")

            if isinstance(reference_id, int):
                if reference_id not in legacy_id_map:
                    raise ValueError(
                        f"Reference {reference_id!r} not found in postgres",
                    )

                reference_id = legacy_id_map[reference_id]

            prepared[document["id"]] = reference_lookup[reference_id]

        return prepared


class AttachImportedFromTransform(AbstractTransform):
    """Attach the upload and upload user data to an imported reference."""

    def __init__(self, mongo: "Mongo", pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def prepare_one(
        self, document: Document, session: AsyncSession
    ) -> Document | None:
        imported_from = document.get("imported_from")

        if not imported_from:
            return None

        row = await get_row_by_id(self._pg, SQLUpload, imported_from["id"])

        if row is None:
            return None

        return await apply_transforms(
            serialize_upload(row), [AttachUserTransform(self._pg)], self._pg
        )

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, Document | None]:
        upload_ids = {
            document["imported_from"]["id"]
            for document in documents
            if document.get("imported_from")
        }

        result = await session.execute(
            select(SQLUpload).where(SQLUpload.id.in_(upload_ids)),
        )

        upload_lookup = {
            row.id: await apply_transforms(
                serialize_upload(row),
                [AttachUserTransform(self._pg)],
                self._pg,
            )
            for row in result.scalars()
        }

        prepared: dict[str, Document | None] = {}

        for document in documents:
            imported_from = document.get("imported_from")
            prepared[document["id"]] = (
                upload_lookup.get(imported_from["id"]) if imported_from else None
            )

        return prepared

    async def attach_one(
        self,
        document: Document,
        prepared: Document | None,
    ) -> Document:
        if prepared is None and not document.get("imported_from"):
            return document

        return {**document, "imported_from": prepared}
