from typing import Any, Dict, List, Optional, Union, TYPE_CHECKING
from virtool.data.transforms import AbstractTransform
from virtool.types import Document
from virtool.utils import base_processor
from virtool_core.models.group import GroupMinimal

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class AttachPrimaryGroupTransform(AbstractTransform):
    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> Optional[GroupMinimal]:
        """
        Prepares a group with an id matching the input document's `primary_group` field

            Parameters:
                document (Document): The input document missing a primary group

            Returns:
                A complete group
        """
        group_id = document.get("primary_group", None)

        if group_id:
            return base_processor(await self._mongo.groups.find_one(group_id))

        return None

    async def attach_one(self, document: Document, prepared: Any):
        """
        Attaches a group to the input document

            Parameters:
                document (Document): The input document missing a primary group
                prepared (Any): The group to be attached

            Returns:
                The input document with a complete group keyed by "primary_group"
        """
        return {**document, "primary_group": prepared}

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        """
        Prepares groups with ids matching the input documents' `primary_group` fields;
        accepts multiple input documents

            Parameters:
                documents (List[Document]): The input documents missing primary groups

            Returns:
                A dictionary of complete groups indexed by the input documents' `id` fields
        """
        group_ids: List[str | None] = list(
            {document.get("primary_group", None) for document in documents}
        )

        group_dict = {
            group["_id"]: base_processor(group)
            async for group in self._mongo.groups.find({"_id": {"$in": group_ids}})
        }

        return {
            document["id"]: group_dict.get(document.get("primary_group"))
            for document in documents
        }


class AttachGroupsTransform(AbstractTransform):
    def __init__(self, mongo: "Mongo"):
        self._mongo = mongo

    async def prepare_one(self, document: Document) -> List[Dict]:
        """
        Prepares a list of groups with ids matching the input document's `groups` field

            Parameters:
                document (Document): The input document missing a list of groups

            Returns:
                A list of complete groups
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

            Parameters:
                document (Document): The input document missing a list of groups
                prepared (Any): The list of groups to be attached

            Returns:
                The input document with a list of complete groups keyed by "groups"
        """
        return {**document, "groups": prepared}

    async def prepare_many(
        self, documents: List[Document]
    ) -> Dict[Union[int, str], Any]:
        """
        Prepares lists of groups with ids matching the input documents' `primary_group` fields;
        accepts multiple input documents

            Parameters:
                documents (List[Document]): The input documents missing lists of groups

            Returns:
                A dictionary of lists of complete groups indexed by the input documents' `id` fields
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
