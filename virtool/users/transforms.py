"""
Transforms for attaching user data to documents or additional data to user documents.

TODO: Drop legacy group id support when we fully migrate to integer ids.
"""
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import compose_legacy_id_expression
from virtool.data.transforms import AbstractTransform
from virtool.groups.pg import SQLGroup, merge_group_permissions
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor


class AttachPermissionsTransform(AbstractTransform):
    """Attaches permissions to a user document based on the groups they belong to."""

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(
        self, document: Document, prepared: dict[str, bool]
    ) -> Document:
        return {
            **document,
            "permissions": prepared,
        }

    async def prepare_one(self, document: Document) -> dict[str, bool]:
        if not document["groups"]:
            return generate_base_permissions()

        async with AsyncSession(self._pg) as session:
            result = await session.execute(
                select(SQLGroup).where(
                    compose_legacy_id_expression(SQLGroup, document["groups"])
                )
            )

            return merge_group_permissions(
                [group.to_dict() for group in result.scalars().all()]
            )

    async def prepare_many(self, documents: list[Document]) -> dict[int | str, Any]:
        all_group_ids: set[int | str] = {
            group_id for document in documents for group_id in document["groups"]
        }

        if all_group_ids:
            async with AsyncSession(self._pg) as session:
                result = await session.execute(
                    select(SQLGroup).where(
                        compose_legacy_id_expression(SQLGroup, all_group_ids)
                    )
                )

                groups = [group.to_dict() for group in result.scalars().all()]

                all_groups_map = {
                    **{group["id"]: group for group in groups},
                    **{group["legacy_id"]: group for group in groups},
                }

            return {
                document["id"]: merge_group_permissions(
                    [all_groups_map[group_id] for group_id in document["groups"]]
                )
                for document in documents
            }

        return {document["id"]: generate_base_permissions() for document in documents}


class AttachUserTransform(AbstractTransform):
    """
    Attaches more complete user data to a document with a `user.id` field.

    """

    def __init__(self, mongo, ignore_errors: bool = False):
        self._db = mongo
        self._ignore_errors = ignore_errors

    def _extract_user_id(self, document: Document) -> str | None:
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

    async def prepare_one(self, document: Document) -> Document:
        user_id = self._extract_user_id(document)

        if user_data := base_processor(
            await self._db.users.find_one(user_id, ATTACH_PROJECTION)
        ):
            return user_data

        raise KeyError(f"Document contains non-existent user: {user_id}.")

    async def prepare_many(self, documents: list[Document]) -> dict[str | str, Any]:
        user_ids = list({self._extract_user_id(document) for document in documents})

        return {
            document["_id"]: base_processor(document)
            async for document in self._db.users.find(
                {"_id": {"$in": user_ids}}, ATTACH_PROJECTION
            )
        }
