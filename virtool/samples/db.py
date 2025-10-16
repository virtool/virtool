"""Code for working with samples in the database and filesystem."""

import asyncio
from collections import defaultdict
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.errors
import virtool.mongo.utils
import virtool.samples.utils
import virtool.utils
from virtool.api.errors import APINotFound
from virtool.data.transforms import AbstractTransform
from virtool.errors import DatabaseError
from virtool.groups.pg import SQLGroup
from virtool.mongo.core import Mongo
from virtool.mongo.utils import get_one_field
from virtool.samples.models import WorkflowState
from virtool.samples.sql import SQLSampleArtifact, SQLSampleReads
from virtool.samples.utils import PATHOSCOPE_TASK_NAMES
from virtool.settings.models import Settings
from virtool.types import Document
from virtool.uploads.sql import SQLUpload
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

        artifacts = (
            await session.execute(
                select(SQLSampleArtifact).filter_by(sample=sample_id),
            )
        ).scalars()

        reads_files = (
            await session.execute(
                select(SQLSampleReads).filter_by(sample=sample_id),
            )
        ).scalars()

        artifacts = [artifact.to_dict() for artifact in artifacts]
        reads = [reads_file.to_dict() for reads_file in reads_files]

        if document["ready"]:
            for artifact in artifacts:
                name_on_disk = artifact["name_on_disk"]
                artifact["download_url"] = (
                    f"/samples/{sample_id}/artifacts/{name_on_disk}"
                )

        for reads_file in reads:
            if upload := reads_file.get("upload"):
                reads_file["upload"] = (
                    (
                        await session.execute(
                            select(SQLUpload).filter_by(id=upload),
                        )
                    ).scalar()
                ).to_dict()

            if document["ready"]:
                reads_file["download_url"] = (
                    f"/samples/{sample_id}/reads/{reads_file['name']}"
                )

        return {"artifacts": artifacts, "reads": reads}


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


def compose_sample_workflow_query(workflows: list[str]) -> dict[str, dict] | None:
    """Compose a MongoDB query for filtering samples by completed workflow.

    :param workflows:
    :return: a MongoDB query for filtering by workflow

    """
    workflow_query = defaultdict(set)

    for workflow_query_string in workflows:
        for pair in workflow_query_string.split(" "):
            pair = pair.split(":")

            if len(pair) == 2:
                workflow, condition = pair
                condition = convert_workflow_condition(condition)

                if condition is not None:
                    workflow_query[workflow].add(condition)

    if any(workflow_query):
        return {
            workflow: {"$in": list(conditions)}
            for workflow, conditions in workflow_query.items()
        }

    return None


def convert_workflow_condition(condition: str) -> dict | None:
    return {"none": False, "pending": "ip", "ready": True}.get(condition)


async def create_sample(
    mongo,
    name: str,
    host: str,
    isolate: str,
    group: int | str,
    locale: str,
    library_type: str,
    subtractions: list[str],
    notes: str,
    labels: list[int],
    user_id: str,
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
            "nuvs": False,
            "pathoscope": False,
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
            "workflows": define_initial_workflows(library_type),
            "paired": paired,
        },
    )

    return base_processor(document)


async def get_sample_owner(mongo: "Mongo", sample_id: str) -> str | None:
    """A Shortcut function for getting the owner user id of a sample given its
    ``sample_id``.

    :param mongo: the application database client
    :param sample_id: the id of the sample to get the owner for
    :return: the id of the owner user

    """
    document = await mongo.samples.find_one(sample_id, ["user"])

    if document:
        return document["user"]["id"]

    return None


def define_initial_workflows(library_type) -> dict[str, str]:
    """Checks for incompatibility workflow states

    :param library_type: to check for compatability
    :return: initial workflow states

    """
    if library_type == "amplicon":
        return {
            "aodp": WorkflowState.NONE.value,
            "iimi": WorkflowState.INCOMPATIBLE.value,
            "nuvs": WorkflowState.INCOMPATIBLE.value,
            "pathoscope": WorkflowState.INCOMPATIBLE.value,
        }

    return {
        "aodp": WorkflowState.INCOMPATIBLE.value,
        "iimi": WorkflowState.NONE.value,
        "nuvs": WorkflowState.NONE.value,
        "pathoscope": WorkflowState.NONE.value,
    }


def derive_workflow_state(analyses: list, library_type) -> dict:
    """Derive a workflow state dictionary for the passed analyses and library_type.

    Workflows that are incompatible with the library type are set to "incompatible".

    :param analyses: the analyses for the sample
    :param library_type: for compatability check
    :return: workflow state of a sample

    """
    workflow_states = define_initial_workflows(library_type)

    for analysis in analyses:
        workflow_name = get_workflow_name(analysis["workflow"])

        if workflow_states[workflow_name] in (
            WorkflowState.COMPLETE.value,
            WorkflowState.INCOMPATIBLE.value,
        ):
            continue

        workflow_states[workflow_name] = (
            WorkflowState.COMPLETE.value
            if analysis["ready"]
            else WorkflowState.PENDING.value
        )

    return {"workflows": workflow_states}


def get_workflow_name(workflow_name: str) -> str:
    """Returns the name of the workflow that is being used. If the workflow name is
    "pathoscope_bowtie" or "pathoscope_bowtie2", then "pathoscope" is returned.

    :param workflow_name: the name of the workflow
    :return: the name of the workflow that is being used

    """
    if workflow_name in PATHOSCOPE_TASK_NAMES:
        return "pathoscope"

    return workflow_name


async def recalculate_workflow_tags(
    mongo: "Mongo",
    sample_id: str,
    session: AsyncIOMotorClientSession | None = None,
) -> None:
    """Recalculate and apply workflow tags (eg. "ip", True) for a given sample.

    :param mongo: the application database client
    :param sample_id: the id of the sample to recalculate tags for
    :param session: an optional MongoDB session to use
    :return: the updated sample document

    """
    analyses, library_type = await asyncio.gather(
        mongo.analyses.find({"sample.id": sample_id}, ["ready", "workflow"]).to_list(
            None,
        ),
        get_one_field(mongo.samples, "library_type", sample_id),
    )

    await mongo.samples.update_one(
        {"_id": sample_id},
        {
            "$set": {
                **virtool.samples.utils.calculate_workflow_tags(analyses),
                **derive_workflow_state(analyses, library_type),
            },
        },
        session=session,
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
