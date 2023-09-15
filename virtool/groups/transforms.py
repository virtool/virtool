from typing import Any, Dict, List, Optional, Union, TYPE_CHECKING

import pymongo
from virtool_core.models.group import GroupMinimal

from virtool.data.transforms import AbstractTransform
from virtool.types import Document
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class AttachPrimaryGroupTransform(AbstractTransform):
    """
    Attach primary groups to document(s) with a `primary_group` field
    """

    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> Optional[GroupMinimal]:
        """
        Prepare the primary group of a document for attachment

        :param document: an input document with a `primary_group` field
        :return: the group associated with the document
        """
        group_id = document.get("primary_group")

        if group_id:
            return base_processor(await self._mongo.groups.find_one(group_id))

        return None

    async def attach_one(self, document: Document, prepared: Any):
        """
        Attach a group to the input document

        :param document: the input document associated with the passed group
        :param prepared: the group to be attached
        :return: the input document with an attached primary_group
        """
        return {**document, "primary_group": prepared}

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        """
        Prepare primary groups to be attached to passed documents

        :param documents: input documents with a `primary_group` field
        :return: a dictionary of groups keyed by each input document's id
        """
        group_ids: List[str] = list(
            {
                document.get("primary_group")
                for document in documents
                if document.get("primary_group")
            }
        )

        groups = {
            group["_id"]: base_processor(group)
            async for group in self._mongo.groups.find({"_id": {"$in": group_ids}})
        }

        return {
            document["id"]: groups.get(document.get("primary_group"))
            for document in documents
        }


class AttachGroupsTransform(AbstractTransform):
    """
    Attach Groups to document(s) containing a `groups` field
    """

    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> List[Dict]:
        """
        Prepare a list of groups to be attached to a document

        :param document: an input document with a `groups` field
        :return: a list of groups
        """
        return [
            base_processor(group_doc)
            async for group_doc in self._mongo.groups.find(
                {"_id": {"$in": document.get("groups", [])}},
                sort=[("name", pymongo.ASCENDING)],
            )
        ]

    async def attach_one(self, document: Document, prepared: Any):
        """
        Attach groups to the document

        :param document: the input document associated with the passed groups
        :param prepared: the list of groups to be attached
        :return: the input document with an attached list of groups
        """
        return {**document, "groups": sorted(prepared, key=lambda d: d["name"])}

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        """
        Bulk prepare groups for attachment to passed documents

        :param documents: A list of input documents with `groups` fields
        :return: a dictionary of `document["id"]:list[group]` pairs based on each
        document's `groups` field
        """
        group_ids = list(
            {group for document in documents for group in document["groups"]}
        )

        groups = {
            group["_id"]: base_processor(group)
            async for group in self._mongo.groups.find({"_id": {"$in": group_ids}})
        }

        return {
            document["id"]: [groups[group_id] for group_id in document["groups"]]
            for document in documents
        }
