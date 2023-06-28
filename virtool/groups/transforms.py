from typing import Any, Dict, List, Union
from virtool.mongo.core import Mongo
from virtool.mongo.transforms import AbstractTransform
from virtool.types import Document
from virtool.utils import base_processor


def extract_group_id(document: Document):
    try:
        return document["group"]["id"]

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

    async def prepare_many(self, documents: List[Document]):
        user_ids = [extract_group_id(document) for document in documents]

        return {
            group_doc["_id"]: base_processor(group_doc)
            async for group_doc in self._mongo.groups.find({"_id": {"$in": user_ids}})
        }

    async def attach_many(self, documents: List[Document], prepared: Dict[str, Any]):
        return [
            await self.attach_one(document, prepared[extract_group_id(document)])
            for document in documents
        ]


def extract_group_ids(document: Document) -> List[str]:
    try:
        return document["groups"]

    except KeyError:
        raise ValueError("Document must contain a list of group ids")


class AttachGroupsTransform(AbstractTransform):
    def __init__(self, mongo: Mongo):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> Dict[str, Dict]:
        group_ids = extract_group_ids(document)

        return {
            group_doc["_id"]: base_processor(group_doc)
            async for group_doc in self._mongo.groups.find({"_id": {"$in": group_ids}})
        }

    async def attach_one(self, document: Document, prepared: Any):
        return {**document, "groups": prepared}

    async def prepare_many(self, documents: List[Document]):
        prepared = dict()

        for document in documents:
            prepared[document["_id"]] = await self.prepare_one(document)

        return prepared

    async def attach_many(self, documents: List[Document], prepared: Dict[str, Any]):
        return [
            await self.attach_one(document, prepared[document["_id"]])
            for document in documents
        ]
