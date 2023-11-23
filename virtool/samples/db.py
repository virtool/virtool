"""
Code for working with samples in the database and filesystem.

"""
import asyncio
import os
from asyncio import to_thread
from collections import defaultdict
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from motor.motor_asyncio import AsyncIOMotorClientSession
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from virtool.api.response import NotFound, InsufficientRights
from virtool.errors import DatabaseError
from virtool_core.models.samples import WorkflowState
from virtool_core.models.settings import Settings
from virtool_core.utils import compress_file, file_stats

import virtool.errors
import virtool.mongo.utils
import virtool.samples.utils
import virtool.utils
from virtool.config.cls import Config
from virtool.data.transforms import AbstractTransform
from virtool.groups.pg import SQLGroup
from virtool.mongo.utils import get_one_field
from virtool.samples.models import SQLSampleArtifact, SQLSampleReads
from virtool.samples.utils import join_legacy_read_paths, PATHOSCOPE_TASK_NAMES
from virtool.types import Document
from virtool.uploads.models import SQLUpload
from virtool.utils import base_processor

if TYPE_CHECKING:
    from virtool.mongo.core import Mongo


LIST_PROJECTION = [
    "_id",
    "created_at",
    "host",
    "isolate",
    "library_type",
    "pathoscope",
    "name",
    "nuvs",
    "ready",
    "user",
    "notes",
    "labels",
    "subtractions",
    "workflows",
]

PROJECTION = [
    "_id",
    "created_at",
    "labels",
    "is_legacy",
    "library_type",
    "name",
    "pathoscope",
    "nuvs",
    "group",
    "group_read",
    "group_write",
    "all_read",
    "all_write",
    "ready",
    "user",
]

RIGHTS_PROJECTION = {
    "_id": False,
    "group": True,
    "group_read": True,
    "group_write": True,
    "all_read": True,
    "all_write": True,
    "user": True,
}


UNCHANGABLE_WORKFLOW_STATES = [
    WorkflowState.COMPLETE.value,
    WorkflowState.INCOMPATIBLE.value,
]


class AttachArtifactsAndReadsTransform(AbstractTransform):
    def __init__(self, pg):
        self._pg = pg

    async def attach_one(self, document: Document, prepared: Any) -> Document:
        return {**document, **prepared}

    async def prepare_one(self, document: Document) -> Any:
        sample_id = document["id"]

        async with AsyncSession(self._pg) as session:
            artifacts = (
                await session.execute(
                    select(SQLSampleArtifact).filter_by(sample=sample_id)
                )
            ).scalars()

            reads_files = (
                await session.execute(
                    select(SQLSampleReads).filter_by(sample=sample_id)
                )
            ).scalars()

            artifacts = [artifact.to_dict() for artifact in artifacts]
            reads = [reads_file.to_dict() for reads_file in reads_files]

            if document["ready"]:
                for artifact in artifacts:
                    name_on_disk = artifact["name_on_disk"]
                    artifact[
                        "download_url"
                    ] = f"/samples/{sample_id}/artifacts/{name_on_disk}"

            for reads_file in reads:
                if upload := reads_file.get("upload"):
                    reads_file["upload"] = (
                        (
                            await session.execute(
                                select(SQLUpload).filter_by(id=upload)
                            )
                        ).scalar()
                    ).to_dict()

                if document["ready"]:
                    reads_file[
                        "download_url"
                    ] = f"/samples/{sample_id}/reads/{reads_file['name']}"

        return {"artifacts": artifacts, "reads": reads}


async def check_rights(db, sample_id: str | None, client, write: bool = True) -> bool:
    sample_rights = await db.samples.find_one({"_id": sample_id}, RIGHTS_PROJECTION)
    if not sample_rights:
        raise virtool.errors.DatabaseError("Sample does not exist")

    has_read, has_write = virtool.samples.utils.get_sample_rights(sample_rights, client)

    return has_read and (write is False or has_write)


def compose_sample_workflow_query(workflows: List[str]) -> Optional[Dict[str, Dict]]:
    """
    Compose a MongoDB query for filtering samples by completed workflow.

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


def convert_workflow_condition(condition: str) -> Optional[dict]:
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
    """
    Create, insert, and return a new sample document.

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
        }
    )

    return base_processor(document)


async def get_sample_owner(db, sample_id: str) -> Optional[str]:
    """
    A Shortcut function for getting the owner user id of a sample given its
    ``sample_id``.

    :param db: the application database client
    :param sample_id: the id of the sample to get the owner for
    :return: the id of the owner user

    """
    document = await db.samples.find_one(sample_id, ["user"])

    if document:
        return document["user"]["id"]

    return None


def define_initial_workflows(library_type) -> Dict[str, str]:
    """
    Checks for incompatibility workflow states

    :param library_type: to check for compatability
    :return: initial workflow states

    """
    if library_type == "amplicon":
        return {
            "aodp": WorkflowState.NONE.value,
            "nuvs": WorkflowState.INCOMPATIBLE.value,
            "pathoscope": WorkflowState.INCOMPATIBLE.value,
        }

    return {
        "aodp": WorkflowState.INCOMPATIBLE.value,
        "nuvs": WorkflowState.NONE.value,
        "pathoscope": WorkflowState.NONE.value,
    }


def derive_workflow_state(analyses: list, library_type) -> dict:
    """
    Derive a workflow state dictionary for the passed analyses and library_type.

    Workflows that are incompatible with the library type are set to "incompatible".

    :param analyses: the analyses for the sample
    :param library_type: for compatability check
    :return: workflow state of a sample

    """
    workflow_states = define_initial_workflows(library_type)

    for analysis in analyses:
        workflow_name = get_workflow_name(analysis["workflow"])

        if workflow_states[workflow_name] in UNCHANGABLE_WORKFLOW_STATES:
            continue

        workflow_states[workflow_name] = (
            WorkflowState.COMPLETE.value
            if analysis["ready"]
            else WorkflowState.PENDING.value
        )

    return {"workflows": workflow_states}


def get_workflow_name(workflow_name: str) -> str:
    """
    Returns the name of the workflow that is being used. If the workflow name is
    "pathoscope_bowtie" or "pathoscope_bowtie2", then "pathoscope" is returned.

    :param workflow_name: the name of the workflow
    :return: the name of the workflow that is being used

    """
    if workflow_name in PATHOSCOPE_TASK_NAMES:
        return "pathoscope"

    return workflow_name


async def recalculate_workflow_tags(
    mongo: "Mongo", sample_id: str, session: AsyncIOMotorClientSession | None = None
):
    """
    Recalculate and apply workflow tags (eg. "ip", True) for a given sample.

    :param mongo: the application database client
    :param sample_id: the id of the sample to recalculate tags for
    :param session: an optional MongoDB session to use
    :return: the updated sample document

    """
    analyses, library_type = await asyncio.gather(
        mongo.analyses.find({"sample.id": sample_id}, ["ready", "workflow"]).to_list(
            None
        ),
        get_one_field(mongo.samples, "library_type", sample_id),
    )

    await mongo.samples.update_one(
        {"_id": sample_id},
        {
            "$set": {
                **virtool.samples.utils.calculate_workflow_tags(analyses),
                **derive_workflow_state(analyses, library_type),
            }
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
                (SQLGroup.id == group_id)
                if isinstance(group_id, int)
                else SQLGroup.legacy_id == group_id
            )
        )

        if not result:
            return "Group does not exist"

    return None


def check_is_legacy(sample: Dict[str, Any]) -> bool:
    """
    Check if a sample has legacy read files.

    :param sample: the sample document
    :return: legacy boolean
    """
    files = sample["files"]

    return (
        all(file.get("raw", False) is False for file in files)
        and files[0]["name"] == "reads_1.fastq"
        and (sample["paired"] is False or files[1]["name"] == "reads_2.fastq")
    )


async def compress_sample_reads(db: "Mongo", config: Config, sample: Dict[str, Any]):
    """
    Compress the reads for one legacy samples.

    :param db: the application database object
    :param config: the application configuration dictionary
    :param sample: the sample document

    """
    await update_is_compressed(db, sample)

    if not check_is_legacy(sample):
        return

    paths = join_legacy_read_paths(config, sample)

    data_path = config.data_path
    sample_id = sample["_id"]

    files = []

    for i, path in enumerate(paths):
        target_filename = (
            "reads_1.fq.gz" if "reads_1.fastq" in str(path) else "reads_2.fq.gz"
        )

        target_path = data_path / "samples" / sample_id / target_filename

        await to_thread(compress_file, path, target_path, 1)

        stats = await to_thread(file_stats, target_path)

        files.append(
            {
                "name": target_filename,
                "download_url": f"/download/samples/{sample_id}/{target_filename}",
                "size": stats["size"],
                "raw": False,
                "from": sample["files"][i]["from"],
            }
        )

    await db.samples.update_one({"_id": sample_id}, {"$set": {"files": files}})

    for path in paths:
        await to_thread(os.remove, path)


async def move_sample_files_to_pg(db: "Mongo", pg: AsyncEngine, sample: Dict[str, any]):
    """
    Creates a row in the `sample_reads` table for each file in a sample's `files` array.

    Also, creates a row in the `uploads` table for information stored in a file's
    `from` field with a relation to the `SampleRead`.

    :param db: the application database object
    :param pg: the PostgreSQL AsyncEngine object
    :param sample: the sample document
    """
    files = sample.get("files")
    sample_id = sample["_id"]

    async with AsyncSession(pg) as session:
        for file_ in files:
            from_ = file_.get("from")

            upload = SQLUpload(
                name=from_["name"],
                name_on_disk=from_["id"],
                size=from_["size"],
                uploaded_at=from_.get("uploaded_at"),
            )

            reads = SQLSampleReads(
                name=file_["name"],
                name_on_disk=file_["name"],
                size=file_["size"],
                sample=sample_id,
            )

            upload.reads.append(reads)

            session.add_all([upload, reads])

        await session.commit()

        await db.samples.update_one({"_id": sample_id}, {"$unset": {"files": ""}})


async def update_is_compressed(db, sample: Dict[str, Any]):
    """
    Update the ``is_compressed`` field for the passed ``sample`` in the database if all
    of its files are compressed.

    :param db: the application database
    :param sample: the sample document

    """
    files = sample["files"]

    names = [file["name"] for file in files]

    is_compressed = names in (
        ["reads_1.fq.gz"],
        [
            "reads_1.fq.gz",
            "reads_2.fq.gz",
        ],
    )

    if is_compressed:
        await db.samples.update_one(
            {"_id": sample["_id"]}, {"$set": {"is_compressed": True}}
        )


class NameGenerator:
    """
    Generates unique incrementing sample names based on a base name and a space id.
    """

    def __init__(self, db: "DB", base_name: str, space_id: str):
        self.base_name = base_name
        self.space_id = space_id
        self.db = db
        self.sample_number = 1

    async def get(self, session: AsyncIOMotorClientSession):
        self.sample_number += 1

        while await self.db.samples.count_documents(
            {
                "name": f"{self.base_name} ({self.sample_number})",
                "space_id": self.space_id,
            },
            limit=1,
            session=session,
        ):
            self.sample_number += 1

        return f"{self.base_name} ({self.sample_number})"
