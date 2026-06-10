"""Work with analyses in the database."""

from datetime import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis, SQLAnalysisSubtraction
from virtool.data.transforms import AbstractTransform
from virtool.mongo.core import Mongo
from virtool.samples.utils import get_sample_rights
from virtool.subtractions.pg import SQLSubtraction
from virtool.types import Document


class AttachAnalysisSubtractionsTransform(AbstractTransform):
    """Attach ``{id, name}`` subtraction references to analysis documents.

    Subtraction membership is read from the ``analysis_subtractions`` association
    table. The emitted ``id`` is always the subtraction's integer id.
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "subtractions": sorted(prepared, key=lambda s: s["name"])}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        result = await session.execute(
            select(SQLSubtraction.id, SQLSubtraction.name)
            .join(
                SQLAnalysisSubtraction,
                SQLAnalysisSubtraction.subtraction_id == SQLSubtraction.id,
            )
            .where(SQLAnalysisSubtraction.analysis_id == int(document["id"])),
        )

        return [{"id": id_, "name": name} for id_, name in result.all()]

    async def prepare_many(
        self, documents: list[Document], session: AsyncSession
    ) -> dict[str, list[dict]]:
        # ``base_processor`` stringifies the integer analysis id, so map the integer
        # ``analysis_id`` returned by the query back to the document's string key.
        document_id_by_int = {int(d["id"]): d["id"] for d in documents}

        grouped: dict[str, list[dict]] = {d["id"]: [] for d in documents}

        if document_id_by_int:
            result = await session.execute(
                select(
                    SQLAnalysisSubtraction.analysis_id,
                    SQLSubtraction.id,
                    SQLSubtraction.name,
                )
                .join(
                    SQLSubtraction,
                    SQLSubtraction.id == SQLAnalysisSubtraction.subtraction_id,
                )
                .where(SQLAnalysisSubtraction.analysis_id.in_(document_id_by_int)),
            )

            for analysis_id, id_, name in result.all():
                grouped[document_id_by_int[analysis_id]].append(
                    {"id": id_, "name": name},
                )

        return grouped


async def bump_analysis_updated_at(
    pg_session: AsyncSession,
    analysis_id: int,
    updated_at: datetime,
) -> None:
    """Bump an analysis ``updated_at`` timestamp in Postgres.

    :param pg_session: the active Postgres transaction session
    :param analysis_id: the integer ID of the analysis to bump
    :param updated_at: the timestamp to set
    """
    await pg_session.execute(
        update(SQLAnalysis)
        .where(SQLAnalysis.id == analysis_id)
        .values(updated_at=updated_at),
    )


async def filter_analyses_by_sample_rights(
    client,
    mongo: Mongo,
    analyses: list[dict],
) -> list[dict]:
    """Filter a list of analyses based on the user's rights to the samples they are
    associated with.

    :param client: the client making the request
    :param mongo: the application database client
    :param analyses: the analyses to filter
    :return: the filtered analyses

    """
    sample_ids = {a["sample"]["id"] for a in analyses}

    sample_rights = await mongo.samples.find(
        {"_id": {"$in": list(sample_ids)}},
        [
            "_id",
            "group",
            "group_read",
            "group_write",
            "all_read",
            "all_write",
            "user",
        ],
    ).to_list(None)

    sample_rights_lookup = {s["_id"]: s for s in sample_rights}

    filtered = []

    for analysis in analyses:
        sample_id = analysis["sample"]["id"]

        if get_sample_rights(sample_rights_lookup[sample_id], client):
            filtered.append(analysis)

    return filtered
