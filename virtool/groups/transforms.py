from typing import Any
from virtool.mongo.core import Mongo
from virtool.mongo.transforms import AbstractTransform
from virtool.types import Document
from virtool.utils import base_processor


def extract_group_id(document: Document):
    try:
        return document.get("group").get("id")

    except KeyError:
        raise ValueError("Document must contain a valid group with field `id`")


class AttachGroupTransform(AbstractTransform):
    def __init__(self, mongo: Mongo):
        self._mongo = mongo

    async def prepare_one(self, document: Document):
        group_id = extract_group_id(document)
        group_doc = base_processor(await self._mongo.groups.find_one(group_id))

        if not group_doc:
            raise KeyError(f"Document contains non-existent user: {group_id}.")

        return group_doc

    async def attach_one(self, document: Document, prepared: Any):
        return {**document, "group": prepared}
