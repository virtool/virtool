from sqlalchemy import Integer, cast, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.history.db
from virtool.data.errors import ResourceNotFoundError
from virtool.data.topg import compose_legacy_id_single_expression
from virtool.data.transforms import apply_transforms
from virtool.history.db import legacy_history_document
from virtool.history.models import History, HistoryMinimal, HistorySearchResult
from virtool.history.sql import SQLLegacyHistory
from virtool.history.transforms import AttachDiffTransform
from virtool.indexes.sql import SQLIndex
from virtool.mongo.core import Mongo
from virtool.otus.sql import SQLOTU
from virtool.references.transforms import AttachReferenceTransform
from virtool.users.pg import SQLUser


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
        async with AsyncSession(self._pg) as session:
            if not await session.scalar(
                select(select(SQLOTU.id).where(SQLOTU.id == otu_id).exists()),
            ):
                raise ResourceNotFoundError()

            rows = (
                await session.execute(
                    select(SQLLegacyHistory, SQLUser.handle, SQLIndex.version)
                    .join(SQLUser, SQLLegacyHistory.user_id == SQLUser.id)
                    .outerjoin(SQLIndex, SQLLegacyHistory.index_id == SQLIndex.id)
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
                legacy_history_document(row, handle, index_version)
                for row, handle, index_version in rows
            ],
            [AttachReferenceTransform(self._pg)],
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
                    select(SQLLegacyHistory, SQLUser.handle, SQLIndex.version)
                    .join(SQLUser, SQLLegacyHistory.user_id == SQLUser.id)
                    .outerjoin(SQLIndex, SQLLegacyHistory.index_id == SQLIndex.id)
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

        legacy_row, handle, index_version = row

        document = await apply_transforms(
            legacy_history_document(legacy_row, handle, index_version),
            [
                AttachDiffTransform(self._pg),
                AttachReferenceTransform(self._pg),
            ],
            self._pg,
        )

        return History(**document)
