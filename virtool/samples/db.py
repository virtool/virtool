"""
Code for working with samples in the database and filesystem.

Sample schema:
- _id (str) a sample identifier unique to the instance
- all_read (bool) true when all instance users can read the sample
- all_write (bool) true when all instance users can modify or delete the sample
- created_at (datetime) the creation timestamp
- files (Array[Object]) objects describing uploaded files
  - download_url (str) the URL path at which the file can be downloaded
  - from (Object) describes where the file came from
     - id (str) unique ID of the file - random string prepended to uploaded file name
     - name (str) the original name of the uploaded file
     - size (str) the size of the original file
     - uploaded_at (datetime) when the upload was initiated
  - name (str) the file name on disk
  - raw (str) true if the file is raw data - this is only false for legacy samples that were trimmed on import
  - size (int) the size of the file in bytes
  - size (int) the size of the file in bytes
- group (str) the ID of the owner group
- group_read (bool) true when the owner group can read the sample
- group_write (bool) true when the owner group can modify or delete the sample
- host (str) user-entered host
- isolate (str) user-entered isolate
- labels (List[str]) list of label IDs attached to the sample
- library_type (Allowed["normal", "srna", "amplicon"]) the type of sequencing library
- local (str) user-entered locale - replicated field from many plant virus Genbank records
- paired (bool) true when the sample is paired
- pathoscope (bool) true when at least one pathoscope analysis has been completed for the sample
- name (str) user-entered name
- notes (str) user-entered notes
- nuvs (bool) true when at least one nuvs analysis has been completed for the sample
- quality (JSON) quality data imported from FastQC
- ready (bool) true when the sample creation workflow is complete
- subtraction (str) the default subtraction ID
- user (dict) the creating user
  - id (str) the user ID

"""
import aiohttp.web
import asyncio
import logging
import os
import pymongo.results

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, AsyncEngine

import virtool.jobs.db
import virtool.db.utils
import virtool.errors
import virtool.samples.utils
import virtool.utils
import virtool.samples.utils
from virtool.labels.models import Label

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
    Finds label documents for each label ID given in a request body, then converts each document into a dictionary to
    be placed in the list of dictionaries in the updated sample document


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

    files = await refresh_replacements(db, sample_id)

    if not all([file.get("replacement") for file in files]):
        return None

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


async def get_sample_owner(db, sample_id: str):
    """
    A Shortcut function for getting the owner user id of a sample given its ``sample_id``.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param sample_id: the id of the sample to get the owner for
    :type sample_id: str

    :return: the id of the owner user

    """
    document = await db.samples.find_one(sample_id, ["user"])

    if document:
        return document["user"]["id"]

    return None


async def periodically_prune_old_files(app: aiohttp.web.Application):
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


async def refresh_replacements(db, sample_id: str) -> list:
    """
    Remove sample file `replacement` fields if the linked files have been deleted.

    :param db: the application database client
    :param sample_id: the id of the sample to refresh
    :return: the updated files list

    """
    files = await virtool.db.utils.get_one_field(db.samples, "files", sample_id)

    for file in files:
        replacement = file.get("replacement")

        if replacement and not await db.files.count_documents({"_id": replacement["id"]}):
            file["replacement"] = None

    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": {
            "files": files
        }
    })

    return document["files"]


async def remove_samples(db, settings: dict, id_list: list) -> pymongo.results.DeleteResult:
    """
    Complete removes the samples identified by the document ids in ``id_list``. In order, it:

    - removes all analyses associated with the sample from the analyses collection
    - removes the sample from the samples collection
    - removes the sample directory from the file system

    :param db: a Motor client
    :type db: :class:`.motor.motor_asyncio.AsyncIOMotorClient``

    :param settings: the application settings object
    :type settings: :class:`virtool.app_settings.Settings`

    :param id_list: a list sample ids to remove
    :type id_list: list

    :return: the result from the samples collection remove operation
    :rtype: Coroutine[dict]

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
