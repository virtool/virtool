"""Work with analyses in the database."""

from datetime import datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis, SQLAnalysisSubtraction
from virtool.data.transforms import AbstractTransform
from virtool.samples.sql import SQLLegacySample
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
    pg: AsyncEngine,
    analyses: list[dict],
) -> list[dict]:
    """Filter a list of analyses based on the user's rights to the samples they are
    associated with.

    Sample rights are read from the ``legacy_samples`` Postgres table, keyed by the
    integer sample id the analyses now carry.

    :param client: the client making the request
    :param pg: the application Postgres engine
    :param analyses: the analyses to filter
    :return: the filtered analyses

    """
    sample_ids = {a["sample"]["id"] for a in analyses}

    if not sample_ids:
        return []

    async with AsyncSession(pg) as session:
        rows = (
            await session.execute(
                select(
                    SQLLegacySample.id,
                    SQLLegacySample.group_id,
                    SQLLegacySample.group_read,
                    SQLLegacySample.group_write,
                    SQLLegacySample.all_read,
                    SQLLegacySample.all_write,
                    SQLLegacySample.user_id,
                ).where(SQLLegacySample.id.in_(sample_ids)),
            )
        ).all()

    sample_rights_lookup = {
        row.id: {
            "group": row.group_id,
            "group_read": row.group_read,
            "group_write": row.group_write,
            "all_read": row.all_read,
            "all_write": row.all_write,
            "user": {"id": row.user_id},
        }
        for row in rows
    }

    filtered = []

    for analysis in analyses:
        rights = sample_rights_lookup.get(analysis["sample"]["id"])

        if rights is not None and get_sample_rights(rights, client):
            filtered.append(analysis)

    return filtered
