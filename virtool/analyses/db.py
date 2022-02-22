"""
Work with analyses in the database.

"""
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.db.utils
import virtool.utils
from virtool.analyses.models import AnalysisFile
from virtool.db.transforms import AbstractTransform, apply_transforms
from virtool.indexes.db import get_current_id_and_version
from virtool.subtractions.db import AttachSubtractionTransform
from virtool.types import Document
from virtool.users.db import AttachUserTransform
from virtool.utils import base_processor

PROJECTION = (
    "_id",
    "workflow",
    "created_at",
    "index",
    "job",
    "ready",
    "reference",
    "sample",
    "subtractions",
    "updated_at",
    "user",
)

TARGET_FILES = (
    "hmm.tsv",
    "assembly.fa",
    "orfs.fa",
    "unmapped_hosts.fq",
    "unmapped_otus.fq",
)


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
                        select(AnalysisFile).filter_by(analysis=document["id"])
                    )
                )
                .scalars()
                .all()
            )

        return [result.to_dict() for result in results]


async def processor(db, document: Dict[str, Any]) -> Dict[str, Any]:
    """
    Process an analysis document by attaching user and subtraction data.

    :param db: the application database object
    :param document: the analysis document
    :return: the processed analysis document

    """
    return await apply_transforms(
        base_processor(document),
        [AttachSubtractionTransform(db), AttachUserTransform(db)],
    )


async def create(
    db,
    sample_id: str,
    ref_id: str,
    subtractions: List[str],
    user_id: str,
    workflow: str,
    job_id: str,
    analysis_id: Optional[str] = None,
) -> dict:
    """
    Creates a new analysis.

    Ensures that a valid subtraction host was the submitted. Configures read and write
    permissions on the sample document and assigns it a creator username based on the
    requesting connection.

    :param db: the application database object
    :param sample_id: the ID of the sample to create an analysis for
    :param ref_id: the ID of the reference to analyze against
    :param subtractions: the list of the subtraction IDs to remove from the analysis
    :param user_id: the ID of the user starting the job
    :param workflow: the analysis workflow to run
    :param job_id: the ID of the job
    :param analysis_id: the ID of the analysis
    :return: the analysis document

    """
    index_id, index_version = await get_current_id_and_version(db, ref_id)

    created_at = virtool.utils.timestamp()

    document = {
        "ready": False,
        "created_at": created_at,
        "updated_at": created_at,
        "job": {"id": job_id},
        "files": [],
        "workflow": workflow,
        "sample": {"id": sample_id},
        "index": {"id": index_id, "version": index_version},
        "reference": {
            "id": ref_id,
            "name": await virtool.db.utils.get_one_field(db.references, "name", ref_id),
        },
        "subtractions": subtractions,
        "user": {
            "id": user_id,
        },
    }

    if analysis_id:
        document["_id"] = analysis_id

    return base_processor(await db.analyses.insert_one(document))
