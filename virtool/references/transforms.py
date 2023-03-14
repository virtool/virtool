from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional

from sqlalchemy.ext.asyncio import AsyncEngine

from virtool.mongo.transforms import AbstractTransform, apply_transforms
from virtool.pg.utils import get_row_by_id
from virtool.types import Document
from virtool.uploads.models import Upload
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor, get_safely

if TYPE_CHECKING:
    from virtool.mongo.core import DB


class ImportedFromTransform(AbstractTransform):
    """
    Attach the upload and upload user data to an imported reference.

    """

    def __init__(self, mongo: DB, pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def prepare_one(self, document: Document) -> Optional[Document]:
        try:
            upload_id = document["imported_from"]["id"]
        except KeyError:
            return None

        row = await get_row_by_id(self._pg, Upload, upload_id)

        return await apply_transforms(row.to_dict(), [AttachUserTransform(self._mongo)])

    async def attach_one(
        self, document: Document, prepared: Optional[Document]
    ) -> Document:
        if prepared is None:
            return document

        return {**document, "imported_from": prepared}


PROJECTION = ["_id", "name", "data_type"]


class AttachReferenceTransform(AbstractTransform):
    def __init__(self, mongo: "DB"):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> Any:
        reference_id = get_safely(document, "reference", "id")

        if reference_id:
            return base_processor(
                await self._mongo.references.find_one({"_id": reference_id}, PROJECTION)
            )

        raise ValueError("Missing reference id")

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "reference": prepared}
