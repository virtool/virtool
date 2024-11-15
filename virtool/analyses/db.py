"""Work with analyses in the database."""

from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from virtool.analyses.models import SQLAnalysisFile
from virtool.data.transforms import AbstractTransform
from virtool.mongo.core import Mongo
from virtool.samples.utils import get_sample_rights
from virtool.types import Document


class AttachAnalysisFileTransform(AbstractTransform):
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "files": prepared}

    async def prepare_one(self, document: Document) -> Any:
        async with AsyncSession(self._pg) as session:
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
