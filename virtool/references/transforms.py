from __future__ import annotations

from typing import Any, TYPE_CHECKING
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import compose_legacy_id_expression
from virtool.data.transforms import AbstractTransform
from virtool.data.transforms import apply_transforms
from virtool.groups.pg import SQLGroup
from virtool.pg.utils import get_row_by_id
from virtool.types import Document
from virtool.uploads.models import SQLUpload
from virtool.users.transforms import AttachUserTransform
from virtool.utils import get_safely, base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


PROJECTION = ["_id", "name", "data_type"]


class AttachReferenceTransform(AbstractTransform):
    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> Document | None:
        reference_id = get_safely(document, "reference", "id")

        if reference_id:
            return base_processor(
                await self._mongo.references.find_one({"_id": reference_id}, PROJECTION)
            )

        raise ValueError("Missing reference id")

    async def attach_one(self, document: Document, prepared: Any) -> Document | None:
        return {**document, "reference": prepared}


class AttachImportedFromTransform(AbstractTransform):
    """
    Attach the upload and upload user data to an imported reference.

    """

    def __init__(self, mongo: Mongo, pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def prepare_one(self, document: Document) -> Optional[Document]:
        try:
            upload_id = document["imported_from"]["id"]
        except KeyError:
            return None

        row = await get_row_by_id(self._pg, SQLUpload, upload_id)

        return await apply_transforms(row.to_dict(), [AttachUserTransform(self._mongo)])

    async def attach_one(
        self, document: Document, prepared: Optional[Document]
    ) -> Document:
        if prepared is None:
            return document

        return {**document, "imported_from": prepared}
