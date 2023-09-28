from typing import Any, TYPE_CHECKING, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.transforms import AbstractTransform
from virtool.groups.pg import SQLGroup, merge_group_permissions
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


class AttachPermissionsTransform(AbstractTransform):
    """
    Attaches permissions to a user document.
    """

    def __init__(self, mongo: "Mongo", pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def attach_one(self, document, prepared) -> Document:
        """
        Attach permissions to a user document.

        :param document: the user document
        :param prepared: list of groups associated with the user
        :return: the user document with permissions attached
        """
        return {
            **document,
            "permissions": merge_group_permissions(prepared),
        }

    async def prepare_one(self, document) -> list[Document]:
        """
        Prepares a list of groups associated with a user.

        :param document: the user document
        :return: a list of groups associated with the user
        """
        if not document["groups"]:
            return []

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLGroup).filter(SQLGroup.id.in_(document["groups"]))
            )

            return [group.to_dict() for group in result.scalars()]

    async def prepare_many(self, documents: list[Document]) -> dict[int | str, Any]:
        """
        Prepares a dictionary mapping users to a list of member groups.

        :param documents: a list of user documents
        :return: a dictionary of groups associated with a list of users
        """
        all_group_ids = set()
        prepared = {}

        for user in documents:
            all_group_ids |= set(user["groups"])
            prepared[user["id"]] = user["groups"]

        if all_group_ids:
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLGroup).filter(SQLGroup.id.in_(all_group_ids))
                )

                all_groups_map = {
                    group.id: group.to_dict() for group in result.scalars()
                }

            return {
                user_id: [all_groups_map[group_id] for group_id in group_ids]
                for user_id, group_ids in prepared.items()
            }
        else:
            return {document["id"]: [] for document in documents}


class AttachUserTransform(AbstractTransform):
    """
    Attaches more complete user data to a document with a `user.id` field.
    """

    def __init__(self, db, ignore_errors: bool = False):
        self._db = db
        self._ignore_errors = ignore_errors

    def _extract_user_id(self, document: Document) -> Optional[str]:
        try:
            user = document["user"]

            try:
                return user["id"]
            except TypeError:
                if isinstance(user, str):
                    return user

                raise
        except KeyError:
            if not self._ignore_errors:
                raise KeyError("Document needs a value at user or user.id")

        return None

    async def attach_one(self, document: Document, prepared: Document) -> Document:
        try:
            user_data = document["user"]
        except KeyError:
            if self._ignore_errors:
                return document

            raise

        if isinstance(user_data, str):
            return {
                **document,
                "user": {
                    "id": user_data,
                    **prepared,
                },
            }

        return {
            **document,
            "user": {
                **document["user"],
                **prepared,
            },
        }

    async def attach_many(
        self, documents: list[Document], prepared: dict[int, Any]
    ) -> list[Document]:
        return [
            (await self.attach_one(document, prepared[self._extract_user_id(document)]))
            for document in documents
        ]

    async def prepare_one(self, document: Document):
        user_id = self._extract_user_id(document)
        user_data = base_processor(
            await self._db.users.find_one(user_id, ATTACH_PROJECTION)
        )

        if not user_data:
            raise KeyError(f"Document contains non-existent user: {user_id}.")

        return user_data

    async def prepare_many(self, documents: list[Document]) -> dict[str | str, Any]:
        user_ids = list({self._extract_user_id(document) for document in documents})

        return {
            document["_id"]: base_processor(document)
            async for document in self._db.users.find(
                {"_id": {"$in": user_ids}}, ATTACH_PROJECTION
            )
        }
