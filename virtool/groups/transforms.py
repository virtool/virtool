from typing import Any, Dict, List, Optional, Union, TYPE_CHECKING
from virtool.data.transforms import AbstractTransform
from virtool.types import Document
from virtool.utils import base_processor
from virtool_core.models.group import GroupMinimal

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class AttachPrimaryGroupTransform(AbstractTransform):
    """
    Attaches Groups to a User document
    """

    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> Optional[GroupMinimal]:
        """
        Prepares a group with an id matching the input document's `primary_group` field

        :param document: the input document missing a primary group
        :return: a complete group
        """
        group_id = document.get("primary_group")

        if group_id:
            return base_processor(await self._mongo.groups.find_one(group_id))

        return None

    async def attach_one(self, document: Document, prepared: Any):
        """
        Attaches a group to the input document

        :param document: the input document missing a primary group
        :param prepared: the group to be attached
        :return: the input document with a complete group keyed by "primary_group"
        """
        return {**document, "primary_group": prepared}

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        """
        Prepares groups with ids matching the input documents' `primary_group` fields;
        accepts multiple input documents

        :param documents: the input documents missing primary groups
        :return: a dictionary of complete groups
        indexed by the input documents' `id` fields
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
    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> List[Dict]:
        """
        Prepares a list of groups with ids matching the input document's `groups` field

        :param document: the input document missing a list of groups
        :return: a list of complete groups
        """
        return [
            base_processor(group_doc)
            async for group_doc in self._mongo.groups.find(
                {"_id": {"$in": document.get("groups", [])}}
            )
        ]

    async def attach_one(self, document: Document, prepared: Any):
        """
        Attaches groups to the input document

        :param document: the input document missing a list of groups
        :param prepared: the list of groups to be attached
        :return: the input document with
        a list of complete groups keyed by "groups"
        """
        return {**document, "groups": prepared}

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        """
        Prepares lists of groups with ids matching
        the input documents' `primary_group` fields;
        accepts multiple input documents

        :param documents: the input documents missing lists of groups
        :return: a dictionary of lists of complete
        groups indexed by the input documents' `id` fields
        """
        group_ids = list(
            {group for document in documents for group in document["groups"]}
        )

        group_dict = {
            group["_id"]: base_processor(group)
            async for group in self._mongo.groups.find({"_id": {"$in": group_ids}})
        }

        return {
            document["id"]: [group_dict[group] for group in document["groups"]]
            for document in documents
        }
