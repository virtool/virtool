from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import (
    compose_legacy_id_multi_expression,
    compose_legacy_id_single_expression,
)
from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.pg.utils import get_row_by_id
from virtool.references.sql import SQLReference
from virtool.types import Document
from virtool.uploads.data import serialize as serialize_upload
from virtool.uploads.sql import SQLUpload
from virtool.users.transforms import AttachUserTransform
from virtool.utils import get_safely


def shape_nested_reference(id_: int, name: str) -> Document:
    """Shape a ``legacy_references`` row into a nested reference doc.

    ``data_type`` is emitted as the constant ``"genome"`` because the column is
    dropped from Postgres.
    """
    return {"id": id_, "data_type": "genome", "name": name}


class AttachReferenceTransform(AbstractTransform):
    """Attach nested references to documents with a ``reference.id`` field.

    The embedded ``reference.id`` may be either a legacy Mongo string or the integer
    ``legacy_references`` primary key during the migration, so a dual-key lookup keyed
    on both forms is built when preparing many documents.
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document | None:
        return {**document, "reference": prepared}

    async def prepare_one(
        self, document: Document, session: AsyncSession
    ) -> Document | None:
        reference_id = get_safely(document, "reference", "id")

        if reference_id is None:
            raise ValueError("Missing reference id")

        row = (
            await session.execute(
                select(SQLReference.id, SQLReference.name).where(
                    compose_legacy_id_single_expression(SQLReference, reference_id),
                ),
            )
        ).first()

        if row is None:
            raise ValueError(f"Reference {reference_id!r} not found in postgres")

        return shape_nested_reference(row.id, row.name)

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, Document | None]:
        reference_ids = {get_safely(d, "reference", "id") for d in documents}

        if not reference_ids:
            return {}

        if None in reference_ids:
            raise ValueError("Missing reference id")

        rows = (
            await session.execute(
                select(
                    SQLReference.id,
                    SQLReference.legacy_id,
                    SQLReference.name,
                ).where(
                    compose_legacy_id_multi_expression(SQLReference, reference_ids),
                ),
            )
        ).all()

        reference_lookup: dict[int | str, Document] = {}

        for row in rows:
            shaped = shape_nested_reference(row.id, row.name)
            reference_lookup[row.id] = shaped

            if row.legacy_id is not None:
                reference_lookup[row.legacy_id] = shaped

        prepared: dict[str, Document | None] = {}

        for document in documents:
            reference_id = get_safely(document, "reference", "id")

            if reference_id not in reference_lookup:
                raise ValueError(f"Reference {reference_id!r} not found in postgres")

            prepared[document["id"]] = reference_lookup[reference_id]

        return prepared


class AttachImportedFromTransform(AbstractTransform):
    """Attach the upload and upload user data to an imported reference."""

    def __init__(self, pg: AsyncEngine):
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
