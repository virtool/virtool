"""
Code for working with samples in the database and filesystem.

"""
import asyncio
import logging
import os
from typing import Any, Dict, List, Optional

from pymongo.results import DeleteResult
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

import virtool.db.utils
import virtool.errors
import virtool.jobs.db
import virtool.samples.utils
import virtool.samples.utils
import virtool.pg.utils
import virtool.utils
from virtool.labels.models import Label
from virtool.samples.utils import join_legacy_read_paths
from virtool.tasks.task import Task
from virtool.types import App
from virtool.utils import compress_file, file_stats
from virtool.uploads.models import Upload

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
    "user": True
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
            results = await session.execute(select(Label).filter(Label.id.in_(document["labels"])))

        for label in results.scalars():
            labels.append(label.to_dict())

    return {
        **document,
        "labels": labels
    }


async def attempt_file_replacement(app, sample_id, user_id):
    db = app["db"]
    pg = app["pg"]

    await refresh_files(db, pg, sample_id)

    update_job = await virtool.db.utils.get_one_field(db.samples, "update_job", sample_id)

    if update_job and await virtool.db.utils.id_exists(db.jobs, update_job["id"]):
        return

    logger.info(f"Starting file replacement for sample {sample_id}")

    task_args = {
        "sample_id": sample_id
    }

    job = await virtool.jobs.db.create(
        db,
        "update_sample",
        task_args,
        user_id
    )

    await app["jobs"].enqueue(job["_id"])

    await db.samples.update_one({"_id": sample_id}, {
        "$set": {
            "update_job": {
                "id": job["_id"]
            }
        }
    })


async def check_name(db, settings, name, sample_id=None):
    if settings["sample_unique_names"]:
        query = {
            "name": name
        }

        if sample_id:
            query["_id"] = {
                "$ne": sample_id
            }

        if await db.samples.count_documents(query):
            return "Sample name is already in use"

    return None


async def check_rights(db, sample_id, client, write=True):
    sample_rights = await db.samples.find_one({"_id": sample_id}, RIGHTS_PROJECTION)

    if not sample_rights:
        raise virtool.errors.DatabaseError("Sample does not exist")

    has_read, has_write = virtool.samples.utils.get_sample_rights(sample_rights, client)

    return has_read and (write is False or has_write)


def compose_workflow_conditions(workflow, url_query):
    values = url_query.getall(workflow, None)

    if values is None:
        return None

    values = set(values)

    conditions = list()

    if values and values != {"true", "false", "ip"}:
        if "true" in values:
            conditions.append(True)

        if "false" in values:
            conditions.append(False)

        if "ip" in values:
            conditions.append("ip")

    if conditions:
        if len(conditions) == 1:
            return {
                workflow: conditions[0]
            }

        return {
            workflow: {
                "$in": conditions
            }
        }

    return None


def compose_analysis_query(url_query):
    pathoscope = compose_workflow_conditions("pathoscope", url_query)
    nuvs = compose_workflow_conditions("nuvs", url_query)

    if pathoscope and nuvs:
        return {
            "$or": [
                pathoscope,
                nuvs
            ]
        }

    return pathoscope or nuvs or None


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


async def periodically_prune_old_files(app: App):
    """
    Removes old, not-in-use sample files when the sample flag `prune` is set to `True`.

    :param app: the application object

    """
    db = app["db"]

    logger.info("Running scheduled sample file pruning.")

    async for sample in db.samples.find({"prune": True}, ["files"]):
        sample_id = sample["_id"]

        # Count running analyses that are still using the old non-cache trimmed files.
        count = await db.analyses.count_documents({
            "sample.id": sample_id,
            "ready": False,
            "cache": {
                "$exists": False
            }
        })

        # If there are no analyses using the files, delete them and unset the prune field on the sample.
        if not count:
            logger.info(f"Pruning files for sample {sample_id}.")

            aws = list()

            sample_path = virtool.samples.utils.join_sample_path(app["settings"], sample_id)

            for suffix in [1, 2]:
                path = os.path.join(sample_path, f"reads_{suffix}.fastq")
                app["run_in_thread"](virtool.utils.rm, path)
                aws.append(aws)

            await asyncio.gather(*aws)

            await db.samples.update_one({"_id": sample_id}, {
                "$unset": {
                    "prune": ""
                }
            })


async def recalculate_workflow_tags(db, sample_id: str) -> dict:
    """
    Recalculate and apply workflow tags (eg. "ip", True) for a given sample.

    :param db: the application database client
    :param sample_id: the id of the sample to recalculate tags for
    :return: the updated sample document

    """
    analyses = await asyncio.shield(db.analyses.find({"sample.id": sample_id}, ["ready", "workflow"]).to_list(None))

    update = virtool.samples.utils.calculate_workflow_tags(analyses)

    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": update
    }, projection=LIST_PROJECTION)

    return document


async def refresh_files(db, pg: AsyncEngine, sample_id: str) -> list:
    """
    Remove upload IDs from the sample `files` field if the linked files have been deleted.

    :param db: the application database client
    :param sample_id: the id of the sample to refresh
    :return: the updated files list

    """
    files = await virtool.db.utils.get_one_field(db.samples, "files", sample_id)

    files = [upload_id for upload_id in files if await virtool.pg.utils.get_row(pg, upload_id, Upload)]

    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": {
            "files": files
        }
    })

    return document["files"]


async def remove_samples(db, settings: Dict[str, Any], id_list: List[str]) -> DeleteResult:
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
    if not isinstance(id_list, list):
        raise TypeError("id_list must be a list")

    # Remove all analysis documents associated with the sample.
    await db.analyses.delete_many({"sample.id": {
        "$in": id_list
    }})

    # Remove the samples described by id_list from the database.
    result = await db.samples.delete_many({"_id": {
        "$in": id_list
    }})

    for sample_id in id_list:
        try:
            path = virtool.samples.utils.join_sample_path(settings, sample_id)
            virtool.utils.rm(path, recursive=True)
        except FileNotFoundError:
            pass

    return result


async def validate_force_choice_group(db, data):
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
        # All files have the `raw` flag set false indicating they are legacy data.
        all(file.get("raw", False) is False for file in files) and

        # File naming matches expectations.
        files[0]["name"] == "reads_1.fastq" and
        (sample["paired"] is False or files[1]["name"] == "reads_2.fastq")
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

    is_compressed = (
        names == ["reads_1.fq.gz"] or
        names == ["reads_1.fq.gz", "reads_2.fq.gz"]
    )

    if is_compressed:
        await db.samples.update_one({"_id": sample["_id"]}, {
            "$set": {
                "is_compressed": True
            }
        })


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
        target_filename = "reads_1.fq.gz" if "reads_1.fastq" in path else "reads_2.fq.gz"
        target_path = os.path.join(data_path, "samples", sample_id, target_filename)

        await app["run_in_thread"](compress_file, path, target_path, 1)

        stats = await app["run_in_thread"](file_stats, target_path)

        assert os.path.isfile(target_path)

        files.append({
            "name": target_filename,
            "download_url": f"/download/samples/{sample_id}/{target_filename}",
            "size": stats["size"],
            "raw": False,
            "from": sample["files"][i]["from"]
        })

    await app["db"].samples.update_one({"_id": sample_id}, {
        "$set": {
            "files": files
        }
    })

    for path in paths:
        await app["run_in_thread"](os.remove, path)


class CompressSamplesTask(Task):
    """
    Compress the legacy FASTQ file for all uncompressed samples.

    """
    task_type = "compress_samples"

    def __init__(self, app, process_id):
        super().__init__(app, process_id)

        self.steps = [
            self.compress_samples
        ]

    async def compress_samples(self):
        query = {
            "is_legacy": True,
            "is_compressed": {
                "$exists": False
            }
        }

        count = await self.db.samples.count_documents(query)

        tracker = await self.get_tracker(count)

        while True:
            sample = await self.db.samples.find_one(query)

            if sample is None:
                break

            await compress_sample_reads(self.app, sample)
            await tracker.add(1)

            logger.info(
                f"Compressed legacy sample {sample['_id']} ({tracker.progress}%)"
            )
