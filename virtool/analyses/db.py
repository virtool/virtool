"""Work with analyses in the database."""

from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.sql import SQLAnalysis, SQLAnalysisFile
from virtool.data.transforms import AbstractTransform
from virtool.mongo.core import Mongo
from virtool.samples.utils import get_sample_rights
from virtool.types import Document


async def bump_analysis_updated_at(
    mongo: Mongo,
    mongo_session: AsyncIOMotorClientSession,
    pg_session: AsyncSession,
    analysis_id: str,
    updated_at: datetime,
) -> None:
    """Bump an analysis ``updated_at`` timestamp in both Postgres and Mongo.

    This keeps the two backends in sync during the MongoDB-to-Postgres migration and
    must be called within a :func:`both_transactions` block so the writes commit
    together.

    :param mongo: the application MongoDB client
    :param mongo_session: the active Mongo transaction session
    :param pg_session: the active Postgres transaction session
    :param analysis_id: the ID of the analysis to bump
    :param updated_at: the timestamp to set
    """
    await pg_session.execute(
        update(SQLAnalysis)
        .where(SQLAnalysis.id == analysis_id)
        .values(updated_at=updated_at),
    )

    await mongo.analyses.update_one(
        {"_id": analysis_id},
        {"$set": {"updated_at": updated_at}},
        session=mongo_session,
    )


class AttachAnalysisFileTransform(AbstractTransform):
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "files": prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        results = (
            (
                await session.execute(
                    select(SQLAnalysisFile).filter_by(analysis=document["id"]),
                )
            )
            .scalars()
            .all()
        )

        return [result.to_dict() for result in results]


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
