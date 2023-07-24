from typing import Any, Dict, List, Optional, Union
from virtool.mongo.core import Mongo
from virtool.data.transforms import AbstractTransform
from virtool.types import Document
from virtool.utils import base_processor
from virtool_core.models.group import GroupMinimal


class AttachGroupTransform(AbstractTransform):
    def __init__(self, mongo: Mongo, ignore_errors: bool = False):
        self._mongo = mongo
        self._ignore_errors = ignore_errors

    def _extract_primary_group_id(self, document: Document) -> Optional[str]:
        try:
            primary_group = document["primary_group"]

        except KeyError:
            if not self._ignore_errors:
                raise KeyError("Document needs a value at group or group.id")

            return None

        try:
            return primary_group["id"]
        except TypeError:
            if isinstance(primary_group, str):
                return primary_group

            return None

    async def prepare_one(self, document: Document) -> Optional[GroupMinimal]:
        group_id = self._extract_primary_group_id(document)

        group_data = base_processor(await self._mongo.groups.find_one(group_id))

        return group_data

    async def attach_one(self, document: Document, prepared: Any):
        if not prepared:
            return {**document, "primary_group": None}

        try:
            group_data = document["primary_group"]
        except KeyError:
            if self._ignore_errors:
                return document

            raise

        if isinstance(group_data, str):
            return {
                **document,
                "primary_group": GroupMinimal(**prepared),
            }

        return {**document, "primary_group": GroupMinimal(**prepared)}

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        group_ids = list(
            {self._extract_primary_group_id(document) for document in documents}
        )

        return {
            document["_id"]: base_processor(document)
            async for document in self._mongo.groups.find({"_id": {"$in": group_ids}})
        }

    async def attach_many(
        self, documents: List[Document], prepared: Dict[int, Any]
    ) -> List[Document]:
        return [
            await self.attach_one(
                document, prepared.get(self._extract_primary_group_id(document))
            )
            for document in documents
        ]


class AttachGroupsTransform(AbstractTransform):
    def __init__(self, mongo: Mongo, ignore_errors: bool = False):
        self._mongo = mongo
        self._ignore_errors = ignore_errors

    def _extract_group_ids(self, document: Document) -> List[str]:
        try:
            return document["groups"]

        except (KeyError, ValueError):
            return None

    async def prepare_one(self, document: Document) -> Dict[str, Dict]:
        group_ids = self._extract_group_ids(document)

        to_return = [
            base_processor(group_doc)
            async for group_doc in self._mongo.groups.find({"_id": {"$in": group_ids}})
        ]

        return to_return

    async def attach_one(self, document: Document, prepared: Any):
        to_return = {**document, "groups": [GroupMinimal(**doc) for doc in prepared]}

        return to_return

    async def prepare_many(self, documents: List[Document]):
        prepared = dict()

        for document in documents:
            prepared[base_processor(document).get("id")] = await self.prepare_one(
                document
            )

        return prepared

    async def attach_many(self, documents: List[Document], prepared: Dict[str, Any]):
        return [
            await self.attach_one(
                document, prepared.get(base_processor(document).get("id"))
            )
            for document in documents
        ]
