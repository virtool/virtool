"""
Code for working with samples in the database and filesystem.

"""
import asyncio
import logging
import os
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional
from multidict import MultiDictProxy
from pymongo.results import DeleteResult
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.db.utils
import virtool.errors
import virtool.jobs.db
import virtool.pg.utils
import virtool.samples.utils
import virtool.tasks.pg
import virtool.utils
from virtool.labels.models import Label
from virtool.samples.models import SampleReads, SampleArtifact
from virtool.samples.utils import join_legacy_read_paths
from virtool.subtractions.db import attach_subtractions
from virtool.types import App
from virtool.uploads.models import Upload
from virtool.utils import compress_file, file_stats

logger = logging.getLogger(__name__)

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


async def attach_artifacts_and_reads(pg: AsyncEngine, document: dict) -> dict:
    """
    Attaches associated sample artifacts and reads to a sample document for response.

    :param pg: PostgreSQL AsyncEngine object
    :param document: A document that represents a sample
    :return: Updated document with associated sample artifacts
    """
    ready = document["ready"]
    sample_id = document["_id"]

    async with AsyncSession(pg) as session:
        artifacts = (
            await session.execute(
                select(SampleArtifact).filter_by(sample=sample_id)
            )
        ).scalars()

        reads_files = (
            await session.execute(select(SampleReads).filter_by(sample=sample_id))
        ).scalars()

        artifacts = [artifact.to_dict() for artifact in artifacts]
        reads = [reads_file.to_dict() for reads_file in reads_files]

        if ready:
            for artifact in artifacts:
                name_on_disk = artifact["name_on_disk"]
                artifact["download_url"] = f"/api/samples/{sample_id}/artifacts/{name_on_disk}"

        for reads_file in reads:
            if upload := reads_file.get("upload"):
                reads_file["upload"] = (
                    (
                        await session.execute(select(Upload).filter_by(id=upload))
                    ).scalar()
                ).to_dict()

            if ready:
                reads_file["download_url"] = f"/api/samples/{sample_id}/reads/{reads_file['name']}"

    return {
        **document,
        "artifacts": artifacts,
        "reads": reads,
    }


async def attach_labels(pg: AsyncEngine, document: dict) -> dict:
    """
    Finds label documents for each label ID given in a request body, then converts each document
    into a dictionary to be placed in the list of dictionaries in the updated sample document.

    :param pg: PostgreSQL database connection object
    :param document: sample document to be used for creating or editing a sample
    :return: sample document with updated `labels` entry containing a list of label dictionaries
    """
    labels = list()
    if document.get("labels"):
        async with AsyncSession(pg) as session:
            results = await session.execute(
                select(Label).filter(Label.id.in_(document["labels"]))
            )

        for label in results.scalars():
            labels.append(label.to_dict())

    return {**document, "labels": labels}


async def check_name(
        db,
        settings: dict,
        name: str,
        sample_id: Optional[str] = None
) -> Optional[str]:
    if settings["sample_unique_names"]:
        query = {"name": name}

        if sample_id:
            query["_id"] = {"$ne": sample_id}

        if await db.samples.count_documents(query):
            return "Sample name is already in use"

    return None


async def check_rights(db, sample_id: str, client, write: bool = True) -> bool:
    sample_rights = await db.samples.find_one({"_id": sample_id}, RIGHTS_PROJECTION)

    if not sample_rights:
        raise virtool.errors.DatabaseError("Sample does not exist")

    has_read, has_write = virtool.samples.utils.get_sample_rights(
        sample_rights, client)

    return has_read and (write is False or has_write)


def compose_sample_workflow_query(url_query: MultiDictProxy) -> Optional[dict]:
    """
    Compose a MongoDB query for filtering samples by completed workflow (ie. workflow tags).

    :param url_query: a URL query string to compose the workflow query from
    :return: a MongoDB query for filtering by workflow

    """
    try:
        workflow_query_strings = url_query.getall("workflows")
    except KeyError:
        return None

    workflow_query = defaultdict(set)

    for workflow_query_string in workflow_query_strings:
        for pair in workflow_query_string.split(" "):
            pair = pair.split(":")

            if len(pair) == 2:
                workflow, condition = pair
                condition = convert_workflow_condition(condition)

                if condition is not None:
                    workflow_query[workflow].add(condition)

    if any(workflow_query):
        return {
            workflow: {"$in": list(conditions)} for workflow, conditions in workflow_query.items()
        }

    return None


def convert_workflow_condition(condition: str) -> Optional[dict]:
    return {
        "none": False,
        "pending": "ip",
        "ready": True
    }.get(condition, None)


async def create_sample(
        db,
        name: str,
        host: str,
        isolate: str,
        group: str,
        locale: str,
        library_type: str,
        subtractions: List[str],
        notes: str,
        labels: List[int],
        user_id: str,
        settings: Dict[str, any],
        paired=False,
        _id=None,
) -> Dict[str, any]:
    """
    Create, insert, and return a new sample document.

    :param db: application database client
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
        _id = await virtool.db.utils.get_new_id(db.samples)

    document = {
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
        "group_read": settings.get("sample_group_read"),
        "group_write": settings.get("sample_group_write"),
        "all_read": settings.get("sample_all_read"),
        "all_write": settings.get("sample_all_write"),
        "labels": labels,
        "library_type": library_type,
        "subtractions": subtractions,
        "notes": notes,
        "user": {"id": user_id},
        "group": group,
        "locale": locale,
        "paired": paired,
    }

    await db.samples.insert_one(document)

    return document


async def get_sample_owner(db, sample_id: str) -> Optional[str]:
    """
    A Shortcut function for getting the owner user id of a sample given its ``sample_id``.

    :param db: the application database client
    :param sample_id: the id of the sample to get the owner for
    :return: the id of the owner user

    """
    document = await db.samples.find_one(sample_id, ["user"])

    if document:
        return document["user"]["id"]

    return None


async def recalculate_workflow_tags(db, sample_id: str) -> dict:
    """
    Recalculate and apply workflow tags (eg. "ip", True) for a given sample.

    :param db: the application database client
    :param sample_id: the id of the sample to recalculate tags for
    :return: the updated sample document

    """
    analyses = await asyncio.shield(
        db.analyses.find({"sample.id": sample_id}, [
            "ready", "workflow"]).to_list(None)
    )

    update = virtool.samples.utils.calculate_workflow_tags(analyses)

    document = await db.samples.find_one_and_update(
        {"_id": sample_id}, {"$set": update}, projection=LIST_PROJECTION
    )

    return document


async def remove_samples(
        db, settings: Dict[str, Any], id_list: List[str]
) -> DeleteResult:
    """
    Complete removes the samples identified by the document ids in ``id_list``. In order, it:

    - removes all analyses associated with the sample from the analyses collection
    - removes the sample from the samples collection
    - removes the sample directory from the file system

    :param db: a Motor client
    :param settings: the application settings object
    :param id_list: a list sample ids to remove
    :return: the result from the samples collection remove operation

    """
    # Remove all analysis documents associated with the sample.
    await db.analyses.delete_many({"sample.id": {"$in": id_list}})

    # Remove the samples described by id_list from the database.
    result = await db.samples.delete_many({"_id": {"$in": id_list}})

    for sample_id in id_list:
        try:
            path = virtool.samples.utils.join_sample_path(settings, sample_id)
            virtool.utils.rm(path, recursive=True)
        except FileNotFoundError:
            pass

    return result


async def validate_force_choice_group(db, data: dict) -> Optional[str]:
    try:
        if not await db.groups.count_documents({"_id": data["group"]}):
            return "Group does not exist"

    except KeyError:
        return "Group value required for sample creation"

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


async def update_is_compressed(db, sample: Dict[str, Any]):
    """
    Update the ``is_compressed`` field for the passed ``sample`` in the database if all of its
    files are compressed.

    :param db: the application database
    :param sample: the sample document

    """
    files = sample["files"]

    names = [file["name"] for file in files]

    is_compressed = names == ["reads_1.fq.gz"] or names == [
        "reads_1.fq.gz",
        "reads_2.fq.gz",
    ]

    if is_compressed:
        await db.samples.update_one(
            {"_id": sample["_id"]}, {"$set": {"is_compressed": True}}
        )


async def compress_sample_reads(app: App, sample: Dict[str, Any]):
    """
    Compress the reads for one legacy samples.

    :param app: the application object
    :param sample: the sample document

    """
    await update_is_compressed(app["db"], sample)

    if not check_is_legacy(sample):
        return

    paths = join_legacy_read_paths(app["settings"], sample)

    data_path = app["settings"]["data_path"]
    sample_id = sample["_id"]

    files = list()

    for i, path in enumerate(paths):
        target_filename = (
            "reads_1.fq.gz" if "reads_1.fastq" in str(
                path) else "reads_2.fq.gz"
        )

        target_path = data_path / "samples" / sample_id / target_filename

        await app["run_in_thread"](compress_file, path, target_path, 1)

        stats = await app["run_in_thread"](file_stats, target_path)

        assert target_path.is_file()

        files.append(
            {
                "name": target_filename,
                "download_url": f"/download/samples/{sample_id}/{target_filename}",
                "size": stats["size"],
                "raw": False,
                "from": sample["files"][i]["from"],
            }
        )

    await app["db"].samples.update_one({"_id": sample_id}, {"$set": {"files": files}})

    for path in paths:
        await app["run_in_thread"](os.remove, path)


async def move_sample_files_to_pg(app: App, sample: Dict[str, any]):
    """
    Creates a row in the `sample_reads` table for each file in a sample's `files` array, and
    creates a row in the `uploads` table for information stored in a file's `from` field. The rows
    are then linked via a SQL relationship.

    :param app: the application object
    :param sample: the sample document
    """
    files = sample.get("files")
    sample_id = sample["_id"]

    async with AsyncSession(app["pg"]) as session:
        for file_ in files:
            from_ = file_.get("from")

            upload = Upload(
                name=from_["name"],
                name_on_disk=from_["id"],
                size=from_["size"],
                uploaded_at=from_.get("uploaded_at"),
            )

            reads = SampleReads(
                name=file_["name"],
                name_on_disk=file_["name"],
                size=file_["size"],
                sample=sample_id,
            )

            upload.reads.append(reads)

            session.add_all([upload, reads])

        await session.commit()

        await app["db"].samples.update_one(
            {"_id": sample_id}, {"$unset": {"files": ""}}
        )


async def finalize(
        db,
        pg: AsyncEngine,
        sample_id: str,
        quality: Dict[str, Any],
        run_in_thread: callable,
        data_path: Path,
) -> Dict[str, Any]:
    """
    Finalize a sample document by setting a ``quality`` field and ``ready`` to ``True``

    :param db: the application database object
    :param pg: the PostgreSQL AsyncEngine object
    :param sample_id: the id of the sample
    :param quality: a dict contains quality data
    :param run_in_thread: the application thread running function
    :param data_path: the application data path settings

    :return: the sample document after finalizing

    """
    document = await db.samples.find_one_and_update(
        {"_id": sample_id}, {"$set": {"quality": quality, "ready": True}}
    )

    async with AsyncSession(pg) as session:
        rows = (
            (
                await session.execute(select(Upload)
                                      .filter(SampleReads.sample == sample_id)
                                      .join_from(SampleReads, Upload)
                                      )
            ).unique().scalars()
        )

        for row in rows:
            row.reads.clear()
            row.removed = True
            row.removed_at = virtool.utils.timestamp()

            try:
                await run_in_thread(virtool.utils.rm, data_path / "files" / row.name_on_disk)
            except FileNotFoundError:
                pass

            session.add(row)

        await session.commit()

    return await virtool.samples.db.attach_artifacts_and_reads(pg, document)


async def get_sample(app, sample_id: str):
    """Get the sample document with subtractions, labels, and reads attached."""
    db = app["db"]
    pg = app["pg"]

    document = await db.samples.find_one({"_id": sample_id})

    if not document:
        raise ValueError("Sample {sample_id} does not exist.")

    caches = list()

    async for cache in db.caches.find({"sample.id": sample_id}):
        caches.append(virtool.utils.base_processor(cache))

    document["caches"] = caches

    document = await attach_subtractions(db, document)
    document = await attach_labels(pg, document)
    document = await attach_artifacts_and_reads(pg, document)

    document["paired"] = (len(document["reads"]) == 2)

    return virtool.utils.base_processor(document)
