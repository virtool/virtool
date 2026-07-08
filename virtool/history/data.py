from sqlalchemy import Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.otus.utils
from virtool.data.errors import ResourceConflictError, ResourceNotFoundError
from virtool.data.topg import (
    compose_legacy_id_single_expression,
    retry_both_transactions,
)
from virtool.data.transforms import apply_transforms
from virtool.errors import DatabaseError
from virtool.history.db import delete_history, legacy_history_document, patch_to_version
from virtool.history.models import History, HistoryMinimal, HistorySearchResult
from virtool.history.sql import SQLLegacyHistory
from virtool.history.transforms import AttachDiffTransform
from virtool.mongo.core import Mongo
from virtool.references.transforms import AttachReferenceTransform
from virtool.users.pg import SQLUser
from virtool.utils import base_processor


class HistoryData:
    name = "history"

    def __init__(self, mongo: Mongo, pg: AsyncEngine):
        self._mongo = mongo
        self._pg = pg

    async def find(self, page: int, per_page: int) -> HistorySearchResult:
        """List all change documents.

        :param page: the one-indexed page number to return
        :param per_page: the number of documents to return per page
        :return: a list of all documents
        """
        documents = await virtool.history.db.find(self._mongo, self._pg, page, per_page)

        return HistorySearchResult(**documents)

    async def list_by_otu(self, otu_id: str) -> list[HistoryMinimal]:
        """List all changes affecting a single OTU.

        Changes are read from the ``legacy_history`` table and sorted by OTU version
        descending with a deterministic ``id`` tiebreaker.

        :param otu_id: the ID of the OTU
        :return: the OTU's changes
        """
        if not await self._mongo.otus.count_documents({"_id": otu_id}, limit=1):
            raise ResourceNotFoundError()

        async with AsyncSession(self._pg) as session:
            rows = (
                await session.execute(
                    select(SQLLegacyHistory, SQLUser.handle)
                    .join(SQLUser, SQLLegacyHistory.user_id == SQLUser.id)
                    .where(SQLLegacyHistory.otu == otu_id)
                    .order_by(
                        cast(SQLLegacyHistory.otu_version, Integer)
                        .desc()
                        .nulls_first(),
                        SQLLegacyHistory.id.desc(),
                    ),
                )
            ).all()

        documents = await apply_transforms(
            [
                base_processor(legacy_history_document(row, handle))
                for row, handle in rows
            ],
            [AttachReferenceTransform(self._mongo)],
            self._pg,
        )

        return [HistoryMinimal(**document) for document in documents]

    async def get(self, change_id: str) -> History:
        """Get a change by its ID.

        :param change_id: the ID of the change.
        :return: the change
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLLegacyHistory, SQLUser.handle)
                    .join(SQLUser, SQLLegacyHistory.user_id == SQLUser.id)
                    .where(
                        compose_legacy_id_single_expression(
                            SQLLegacyHistory,
                            change_id,
                        ),
                    ),
                )
            ).first()

        if row is None:
            raise ResourceNotFoundError()

        legacy_row, handle = row

        document = await apply_transforms(
            base_processor(legacy_history_document(legacy_row, handle)),
            [
                AttachDiffTransform(self._pg),
                AttachReferenceTransform(self._mongo),
            ],
            self._pg,
        )

        return History(**document)

    async def get_reference_id(self, change_id: str) -> int:
        """Get the id of the reference a change belongs to.

        :param change_id: the ID of the change
        :return: the integer reference ID
        """
        async with AsyncSession(self._pg) as session:
            reference_id = (
                await session.execute(
                    select(SQLLegacyHistory.reference_id).where(
                        compose_legacy_id_single_expression(
                            SQLLegacyHistory,
                            change_id,
                        ),
                    ),
                )
            ).scalar_one_or_none()

        if reference_id is None:
            raise ResourceNotFoundError()

        return reference_id

    async def delete(self, change_id: str) -> None:
        """Delete a change given its ID.

        Deleting the change will revert the changes make to the associated OTU.

        :param change_id: the ID of the document to delete
        """
        async with AsyncSession(self._pg) as session:
            row = (
                await session.execute(
                    select(SQLLegacyHistory).where(
                        compose_legacy_id_single_expression(
                            SQLLegacyHistory,
                            change_id,
                        ),
                    ),
                )
            ).scalar_one_or_none()

        if row is None:
            raise ResourceNotFoundError()

        try:
            if row.index is not None:
                raise DatabaseError(
                    "Change is included in a build an not revertible",
                )

            otu_id, otu_version = change_id.split(".")

            if otu_version == "removed":
                # Reverting a removal restores the OTU to the version it held just
                # before it was removed, i.e. its highest numbered change. The
                # removal change itself carries a NULL ``otu_version`` and is always
                # reverted by ``patch_to_version``.
                async with AsyncSession(self._pg) as session:
                    target_version = (
                        await session.execute(
                            select(
                                func.max(
                                    cast(SQLLegacyHistory.otu_version, Integer),
                                ),
                            ).where(
                                SQLLegacyHistory.otu == otu_id,
                                SQLLegacyHistory.otu_version.is_not(None),
                            ),
                        )
                    ).scalar_one()
            else:
                target_version = int(otu_version) - 1

            _, patched, history_to_delete = await patch_to_version(
                self._mongo,
                self._pg,
                otu_id,
                target_version,
            )
        except DatabaseError:
            raise ResourceConflictError()

        async def revert(mongo_session, pg_session) -> None:
            # Remove the old sequences from the collection.
            await self._mongo.sequences.delete_many(
                {"otu_id": otu_id},
                session=mongo_session,
            )

            if patched is None:
                await self._mongo.otus.delete_one(
                    {"_id": otu_id},
                    session=mongo_session,
                )
            else:
                patched_otu, sequences = virtool.otus.utils.split(patched)

                # Add the reverted sequences to the collection.
                for sequence in sequences:
                    await self._mongo.sequences.insert_one(
                        sequence,
                        session=mongo_session,
                    )

                # Replace existing otu with patched one. If it doesn't exist, insert it.
                await self._mongo.otus.replace_one(
                    {"_id": otu_id},
                    patched_otu,
                    upsert=True,
                    session=mongo_session,
                )

            await delete_history(pg_session, history_to_delete)

        await retry_both_transactions(self._mongo, self._pg, revert)
