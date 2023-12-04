"""
Transforms for attaching user data to documents or additional data to user documents.

TODO: Drop legacy group id support when we fully migrate to integer ids.
"""
from __future__ import annotations

from typing import Any, TYPE_CHECKING

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.data.topg import compose_legacy_id_expression
from virtool.data.transforms import AbstractTransform
from virtool.groups.pg import SQLGroup, merge_group_permissions
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION
from virtool.users.utils import generate_base_permissions
from virtool.utils import base_processor, get_safely

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


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

    def __init__(self, mongo: Mongo, ignore_errors: bool = False):
        self._mongo = mongo
        self._ignore_errors = ignore_errors

    def preprocess(self, document: Document) -> Document:
        try:
            user_data = document["user"]
        except KeyError:
            if self._ignore_errors:
                return {**document, "user": None}

            raise KeyError("Document has no user field")

        if isinstance(user_data, str):
            return {**document, "user": {"id": user_data}}

        if isinstance(user_data, dict):
            if "id" not in user_data:
                raise KeyError("Document has user field, but no user.id")

            return {**document, "user": user_data}

        if user_data is None:
            return {**document, "user": None}

        raise TypeError("Could not handle document user field")

    async def attach_one(self, document: Document, prepared: Document) -> Document:
        user_id = get_safely(document, "user", "id")

        if user_id is None:
            return {
                **document,
                "user": None,
            }

        return {
            **document,
            "user": {
                **document["user"],
                **prepared,
            },
        }

    async def prepare_one(self, document: Document) -> Document:
        if not isinstance(document, dict):
            raise TypeError("Document must be a dictionary")

        user_id = get_safely(document, "user", "id")

        if user_data := base_processor(
            await self._mongo.users.find_one(user_id, ATTACH_PROJECTION)
        ):
            return user_data

        raise KeyError(f"Document contains non-existent user: {user_id}.")

    async def prepare_many(self, documents: list[Document]) -> dict[str, Any]:
        user_ids = {get_safely(d, "user", "id") for d in documents}
        user_ids.discard(None)

        user_map = {
            document["_id"]: base_processor(document)
            async for document in self._mongo.users.find(
                {"_id": {"$in": list(user_ids)}}, ATTACH_PROJECTION
            )
        }

        if len(user_map) != len(user_ids):
            non_existent_user_ids = user_ids - set(user_map.keys())
            raise KeyError(
                f"Document contains non-existent user(s): {non_existent_user_ids}"
            )

        return {d["id"]: user_map.get(get_safely(d, "user", "id")) for d in documents}
