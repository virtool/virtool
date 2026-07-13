"""Code for working with samples in the database and filesystem."""

from collections import defaultdict
from typing import Any

from sqlalchemy import (
    ColumnExpressionArgument,
    and_,
    exists,
    func,
    not_,
    or_,
    select,
    true,
)
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from yarl import URL

import virtool.samples.utils
from virtool.analyses.sql import SQLAnalysis
from virtool.analyses.utils import WORKFLOW_NAMES
from virtool.data.topg import (
    compose_legacy_id_subquery,
)
from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.groups.pg import SQLGroup
from virtool.models.roles import AdministratorRole
from virtool.samples.sql import (
    SQLLegacySample,
    SQLSampleArtifact,
    SQLSampleReads,
    SQLSampleUpload,
)
from virtool.types import Document
from virtool.uploads.data import serialize as serialize_upload
from virtool.uploads.sql import SQLUpload
from virtool.users.transforms import AttachUserTransform


class AttachArtifactsAndReadsTransform(AbstractTransform):
    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, **prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        sample_id = document["id"]
        sample_subquery = compose_legacy_id_subquery(SQLLegacySample, sample_id)

        artifacts = (
            await session.execute(
                select(SQLSampleArtifact).where(
                    SQLSampleArtifact.sample_id == sample_subquery,
                ),
            )
        ).scalars()

        reads_files = (
            await session.execute(
                select(SQLSampleReads).where(
                    SQLSampleReads.sample_id == sample_subquery,
                ),
            )
        ).scalars()

        artifacts = [artifact.to_dict() for artifact in artifacts]
        reads = [reads_file.to_dict() for reads_file in reads_files]

        for artifact in artifacts:
            artifact["download_url"] = str(
                URL("/samples")
                / str(sample_id)
                / "artifacts"
                / artifact["name_on_disk"]
            )

        for reads_file in reads:
            reads_file["sample"] = reads_file["sample_id"]

            if upload := reads_file.get("upload"):
                upload_dict = serialize_upload(
                    (
                        await session.execute(
                            select(SQLUpload).filter_by(id=upload),
                        )
                    ).scalar()
                )

                reads_file["upload"] = await apply_transforms(
                    upload_dict,
                    [AttachUserTransform(self._pg, ignore_errors=True)],
                    self._pg,
                )

            reads_file["download_url"] = str(
                URL("/samples") / str(sample_id) / "reads" / reads_file["name"]
            )

        return {"artifacts": artifacts, "reads": reads}


class AttachUploadsTransform(AbstractTransform):
    """Attach the input uploads of a sample, ordered as they were on creation.

    Membership comes from the ``sample_uploads`` table, keyed by the integer
    ``sample_id``. The ``index`` column preserves the order the uploads were
    supplied in.

    A sample with no uploads is given ``None`` rather than an empty list.
    """

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "uploads": prepared}

    async def _serialize(self, uploads: list[SQLUpload]) -> list[Document]:
        return await apply_transforms(
            [serialize_upload(upload) for upload in uploads],
            [AttachUserTransform(self._pg, ignore_errors=True)],
            self._pg,
        )

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        result = await session.execute(
            select(SQLUpload)
            .join(SQLSampleUpload, SQLSampleUpload.upload_id == SQLUpload.id)
            .where(SQLSampleUpload.sample_id == document["id"])
            .order_by(SQLSampleUpload.index),
        )

        uploads = list(result.unique().scalars())

        if not uploads:
            return None

        return await self._serialize(uploads)

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[int, list[Document] | None]:
        sample_ids = [document["id"] for document in documents]

        result = await session.execute(
            select(SQLSampleUpload.sample_id, SQLUpload)
            .join(SQLUpload, SQLSampleUpload.upload_id == SQLUpload.id)
            .where(SQLSampleUpload.sample_id.in_(sample_ids))
            .order_by(SQLSampleUpload.sample_id, SQLSampleUpload.index),
        )

        rows = result.unique().all()

        upload_dicts = await self._serialize([upload for _, upload in rows])

        uploads_by_sample = defaultdict(list)

        for (sample_id, _), upload_dict in zip(rows, upload_dicts, strict=True):
            uploads_by_sample[sample_id].append(upload_dict)

        return {
            document["id"]: uploads_by_sample.get(document["id"])
            for document in documents
        }


class DeriveWorkflowTagsTransform(AbstractTransform):
    """Derive the ``nuvs``, ``pathoscope`` and ``workflows`` tags from analyses.

    The tags were formerly stored on the Mongo sample document and recalculated on
    every analysis change. They are now derived on read from the Postgres
    ``analyses`` table, keyed by the integer ``sample_id`` foreign key.

    A page's tags are computed with a single ``GROUP BY`` query bounded to the page's
    sample ids, so the aggregation never scans the whole table.
    """

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, **prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        rows = await session.execute(
            select(SQLAnalysis.workflow, func.bool_or(SQLAnalysis.ready))
            .where(
                SQLAnalysis.sample_id
                == compose_legacy_id_subquery(SQLLegacySample, document["id"]),
            )
            .group_by(SQLAnalysis.workflow),
        )

        ready_by_workflow = {workflow: ready for workflow, ready in rows}

        return virtool.samples.utils.encode_workflow_tags(ready_by_workflow)

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, dict[str, Any]]:
        sample_ids = [document["id"] for document in documents]

        rows = await session.execute(
            select(
                SQLAnalysis.sample_id,
                SQLAnalysis.workflow,
                func.bool_or(SQLAnalysis.ready),
            )
            .where(SQLAnalysis.sample_id.in_(sample_ids))
            .group_by(SQLAnalysis.sample_id, SQLAnalysis.workflow),
        )

        ready_by_sample: dict[int, dict[str, bool]] = defaultdict(dict)

        for sample_id, workflow, ready in rows:
            ready_by_sample[sample_id][workflow] = ready

        return {
            document["id"]: virtool.samples.utils.encode_workflow_tags(
                ready_by_sample.get(document["id"], {}),
            )
            for document in documents
        }


def compose_sample_rights_filter(client) -> ColumnExpressionArgument[bool]:
    """Compose the Postgres predicate scoping samples to those ``client`` can read.

    The requesting user owns the sample, the sample is world-readable, or the sample is
    readable by a group the user belongs to. A full administrator sees every sample,
    matching the single-resource bypass in :func:`has_sample_right`.
    """
    if client.administrator_role == AdministratorRole.FULL:
        return true()

    rights_filter = [
        SQLLegacySample.all_read.is_(True),
        SQLLegacySample.user_id == client.user_id,
    ]

    if client.groups:
        rights_filter.append(
            and_(
                SQLLegacySample.group_read.is_(True),
                SQLLegacySample.group_id.in_(client.groups),
            ),
        )

    return or_(*rights_filter)


WORKFLOW_CONDITIONS = ("none", "pending", "ready")


def _exists_analysis(workflow: str, ready: bool | None = None):
    """Build a correlated ``EXISTS`` on analyses for the current sample row.

    Restricts to ``workflow`` and, when ``ready`` is given, to analyses in that
    ready state. Correlates against the enclosing ``SQLLegacySample`` query.
    """
    conditions = [
        SQLAnalysis.sample_id == SQLLegacySample.id,
        SQLAnalysis.workflow == workflow,
    ]

    if ready is not None:
        conditions.append(SQLAnalysis.ready.is_(ready))

    return exists().where(and_(*conditions))


def _compose_workflow_condition_filter(workflow: str, condition: str):
    """Translate a single ``workflow:condition`` pair into a semi-join predicate.

    Mirrors the legacy tag encoding: ``ready`` matches a completed analysis,
    ``pending`` matches an unfinished analysis with none completed, and ``none``
    matches a workflow with no analyses.
    """
    if condition == "ready":
        return _exists_analysis(workflow, ready=True)

    if condition == "pending":
        return and_(
            _exists_analysis(workflow),
            not_(_exists_analysis(workflow, ready=True)),
        )

    return not_(_exists_analysis(workflow))


def compose_sample_workflow_filter(workflows: list[str]):
    """Compose a Postgres predicate for filtering samples by workflow tag.

    Each ``workflow:condition`` pair becomes a correlated ``EXISTS`` semi-join on
    the analyses table. Conditions for the same workflow are ORed; different
    workflows are ANDed. The predicate is applied before ``LIMIT`` and the count so
    ``found_count`` is correct. Returns ``None`` when nothing parses.

    Pairs with an unknown workflow name or condition are ignored, matching the
    "unrecognised filter is dropped" behaviour of the old Mongo query. This also
    avoids the ``none`` condition on a bogus workflow compiling to a ``NOT EXISTS``
    that matches almost every sample.

    :param workflows: the raw ``?workflows=`` query values
    :return: a SQLAlchemy predicate, or ``None``
    """
    conditions_by_workflow = defaultdict(set)

    for workflow_query_string in workflows:
        for pair in workflow_query_string.split(" "):
            parts = pair.split(":")

            if len(parts) == 2:
                workflow, condition = parts

                if workflow in WORKFLOW_NAMES and condition in WORKFLOW_CONDITIONS:
                    conditions_by_workflow[workflow].add(condition)

    if not conditions_by_workflow:
        return None

    return and_(
        *[
            or_(
                *[
                    _compose_workflow_condition_filter(workflow, condition)
                    for condition in conditions
                ],
            )
            for workflow, conditions in conditions_by_workflow.items()
        ],
    )


async def validate_force_choice_group(pg: AsyncEngine, data: dict) -> str | None:
    group_id: int | str | None = data.get("group")

    if group_id is None:
        return "Group value required for sample creation"

    if group_id == "":
        return None

    async with AsyncSession(pg) as session:
        result = await session.execute(
            select(SQLGroup).where(
                (
                    (SQLGroup.id == group_id)
                    if isinstance(group_id, int)
                    else SQLGroup.legacy_id == group_id
                ),
            ),
        )

        if not result:
            return "Group does not exist"

    return None
