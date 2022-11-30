from typing import Any, List, Dict, Union, TYPE_CHECKING

from virtool.mongo.transforms import AbstractTransform
from virtool.types import Document
from virtool.utils import get_safely, base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import DB

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
