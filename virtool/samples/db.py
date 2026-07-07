"""Code for working with samples in the database and filesystem."""

from collections import defaultdict
from typing import Any

from sqlalchemy import and_, exists, func, not_, or_, select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from yarl import URL

import virtool.errors
import virtool.mongo.utils
import virtool.samples.utils
import virtool.utils
from virtool.analyses.sql import SQLAnalysis
from virtool.analyses.utils import WORKFLOW_NAMES
from virtool.api.errors import APINotFound
from virtool.data.topg import compose_legacy_id_subquery
from virtool.data.transforms import AbstractTransform, apply_transforms
from virtool.errors import DatabaseError
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.samples.sql import SQLLegacySample, SQLSampleArtifact, SQLSampleReads
from virtool.settings.models import Settings
from virtool.types import Document
from virtool.uploads.data import serialize as serialize_upload
from virtool.uploads.sql import SQLUpload
from virtool.users.transforms import AttachUserTransform
from virtool.utils import base_processor

SAMPLE_RIGHTS_PROJECTION = {
    "_id": False,
    "group": True,
    "group_read": True,
    "group_write": True,
    "all_read": True,
    "all_write": True,
    "user": True,
}


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
                URL("/samples") / sample_id / "artifacts" / artifact["name_on_disk"]
            )

        for reads_file in reads:
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
                URL("/samples") / sample_id / "reads" / reads_file["name"]
            )

        return {"artifacts": artifacts, "reads": reads}


class AttachUploadsTransform(AbstractTransform):
    """Attaches upload details to samples that have an uploads field."""

    def __init__(self, pg: AsyncEngine):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        if prepared is None:
            return {**document, "uploads": None}

        uploads = [
            prepared.get(u["id"])
            for u in document.get("uploads", [])
            if u["id"] in prepared
        ]

        return {**document, "uploads": uploads}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        uploads = document.get("uploads")

        if not uploads:
            return None

        upload_ids = [u["id"] for u in uploads]

        result = await session.execute(
            select(SQLUpload).where(SQLUpload.id.in_(upload_ids)),
        )

        upload_dicts = [serialize_upload(upload) for upload in result.scalars()]

        upload_dicts = await apply_transforms(
            upload_dicts,
            [AttachUserTransform(self._pg, ignore_errors=True)],
            self._pg,
        )

        return {u["id"]: u for u in upload_dicts}

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, dict[int, dict] | None]:
        all_upload_ids = set()

        for document in documents:
            uploads = document.get("uploads")
            if uploads:
                all_upload_ids.update(u["id"] for u in uploads)

        if not all_upload_ids:
            return {document["id"]: None for document in documents}

        result = await session.execute(
            select(SQLUpload).where(SQLUpload.id.in_(list(all_upload_ids))),
        )

        upload_dicts = [serialize_upload(upload) for upload in result.scalars()]

        upload_dicts = await apply_transforms(
            upload_dicts,
            [AttachUserTransform(self._pg, ignore_errors=True)],
            self._pg,
        )

        uploads_by_id = {u["id"]: u for u in upload_dicts}

        return {
            document["id"]: uploads_by_id if document.get("uploads") else None
            for document in documents
        }


MONGO_UPLOADS_FIELD = ["uploads"]


class AttachMongoUploadsTransform(AbstractTransform):
    """Attach the reserved ``uploads`` array still sourced from MongoDB.

    Sample metadata is read from Postgres, but the ``uploads`` array is not stored
    there yet. This transform bridges it from Mongo so read responses are unchanged.

    It must run before :class:`~virtool.samples.db.AttachUploadsTransform`, which
    enriches the bridged ``uploads`` array with upload details from Postgres.
    """

    def __init__(self, mongo: Mongo):
        self._mongo = mongo

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, "uploads": prepared}

    async def prepare_one(self, document: Document, session: AsyncSession) -> Any:
        mongo_document = await self._mongo.samples.find_one(
            {"_id": document["id"]},
            MONGO_UPLOADS_FIELD,
        )

        if mongo_document is None:
            raise KeyError(f"Sample missing from Mongo: {document['id']}")

        return mongo_document.get("uploads")

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, Any]:
        sample_ids = [document["id"] for document in documents]

        mongo_documents = {
            mongo_document["_id"]: mongo_document
            async for mongo_document in self._mongo.samples.find(
                {"_id": {"$in": sample_ids}},
                MONGO_UPLOADS_FIELD,
            )
        }

        missing = set(sample_ids) - mongo_documents.keys()

        if missing:
            raise KeyError(f"Samples missing from Mongo: {missing}")

        return {
            document["id"]: mongo_documents[document["id"]].get("uploads")
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

        return virtool.samples.utils.encode_workflow_tags(
            ready_by_workflow,
            document["library_type"],
        )

    async def prepare_many(
        self,
        documents: list[Document],
        session: AsyncSession,
    ) -> dict[str, dict[str, Any]]:
        sample_ids = [document["id"] for document in documents]

        rows = await session.execute(
            select(
                SQLLegacySample.legacy_id,
                SQLAnalysis.workflow,
                func.bool_or(SQLAnalysis.ready),
            )
            .join(SQLAnalysis, SQLAnalysis.sample_id == SQLLegacySample.id)
            .where(SQLLegacySample.legacy_id.in_(sample_ids))
            .group_by(SQLLegacySample.legacy_id, SQLAnalysis.workflow),
        )

        ready_by_sample: dict[str, dict[str, bool]] = defaultdict(dict)

        for legacy_id, workflow, ready in rows:
            ready_by_sample[legacy_id][workflow] = ready

        return {
            document["id"]: virtool.samples.utils.encode_workflow_tags(
                ready_by_sample.get(document["id"], {}),
                document["library_type"],
            )
            for document in documents
        }


async def check_rights_error_check(
    db,
    sample_id: str | None,
    client,
    write: bool = True,
) -> bool:
    try:
        check_right = await check_rights(db, sample_id, client, write=write)
    except DatabaseError as err:
        if "Sample does not exist" in str(err):
            raise APINotFound()
        raise

    return check_right


async def check_rights(db, sample_id: str | None, client, write: bool = True) -> bool:
    sample_rights = await db.samples.find_one(
        {"_id": sample_id},
        SAMPLE_RIGHTS_PROJECTION,
    )
    if not sample_rights:
        raise virtool.errors.DatabaseError("Sample does not exist")

    has_read, has_write = virtool.samples.utils.get_sample_rights(sample_rights, client)

    return has_read and (write is False or has_write)


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


def _workflow_compatible(workflow: str):
    """Predicate selecting samples whose library type is compatible with ``workflow``.

    Mirrors :func:`define_initial_workflows`: ``aodp`` is only compatible with
    ``amplicon`` libraries; ``nuvs`` and ``pathoscope`` only with non-amplicon
    libraries. An incompatible workflow always encodes to ``"incompatible"``, so no
    condition — ``none`` least of all — should match such a sample.
    """
    if workflow == "aodp":
        return SQLLegacySample.library_type == "amplicon"

    return SQLLegacySample.library_type != "amplicon"


def _compose_workflow_condition_filter(workflow: str, condition: str):
    """Translate a single ``workflow:condition`` pair into a semi-join predicate.

    Mirrors the legacy tag encoding: ``ready`` matches a completed analysis,
    ``pending`` matches an unfinished analysis with none completed, and ``none``
    matches a workflow with no analyses. Every condition is additionally
    constrained to samples whose library type makes the workflow compatible, so an
    ``incompatible`` workflow (e.g. ``aodp`` on a normal library) never matches.
    """
    if condition == "ready":
        predicate = _exists_analysis(workflow, ready=True)
    elif condition == "pending":
        predicate = and_(
            _exists_analysis(workflow),
            not_(_exists_analysis(workflow, ready=True)),
        )
    else:
        predicate = not_(_exists_analysis(workflow))

    return and_(_workflow_compatible(workflow), predicate)


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


async def create_sample(
    mongo,
    name: str,
    host: str,
    isolate: str,
    group: int | str,
    locale: str,
    library_type: str,
    subtractions: list[int],
    notes: str,
    labels: list[int],
    user_id: int,
    settings: Settings,
    paired: bool = False,
    _id: str | None = None,
) -> Document:
    """Create, insert, and return a new sample document.

    :param mongo: the application mongo client
    :param name: the sample name
    :param host: user-defined host for the sample
    :param isolate: user-defined isolate for the sample
    :param group: the owner group for the sample
    :param locale: user-defined locale for the sample
    :param library_type: Type of library for a sample, defaults to None
    :param subtractions: IDs of default subtractions for the sample
    :param notes: user-defined notes for the sample
    :param labels: IDs of labels associated with the sample
    :param user_id: the ID of the user that is creating the sample
    :param settings: the application settings
    :param paired: Whether a sample is paired or not, defaults to False
    :param _id: An id to assign to a sample instead of it being automatically generated
    :return: the newly inserted sample document
    """
    if _id is None:
        _id = await virtool.mongo.utils.get_new_id(mongo.samples)

    document = await mongo.samples.insert_one(
        {
            "_id": _id,
            "name": name,
            "host": host,
            "isolate": isolate,
            "created_at": virtool.utils.timestamp(),
            "is_legacy": False,
            "format": "fastq",
            "ready": False,
            "quality": None,
            "hold": True,
            "group_read": settings.sample_group_read,
            "group_write": settings.sample_group_write,
            "all_read": settings.sample_all_read,
            "all_write": settings.sample_all_write,
            "labels": labels,
            "library_type": library_type,
            "subtractions": subtractions,
            "notes": notes,
            "user": {"id": user_id},
            "group": group,
            "locale": locale,
            "paired": paired,
        },
    )

    return base_processor(document)


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
