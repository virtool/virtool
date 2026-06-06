"""Work with analyses in the database."""

from datetime import datetime

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from virtool.analyses.sql import SQLAnalysis
from virtool.mongo.core import Mongo
from virtool.samples.utils import get_sample_rights


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
