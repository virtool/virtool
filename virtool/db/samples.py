import aiohttp.web
import asyncio
import logging
import os
import pymongo.results
import typing

import virtool.db.jobs
import virtool.db.utils
import virtool.errors
import virtool.samples
import virtool.utils

logger = logging.getLogger(__name__)


LIST_PROJECTION = [
    "_id",
    "name",
    "host",
    "isolate",
    "created_at",
    "user",
    "imported",
    "archived",
    "pathoscope",
    "nuvs"
]

PROJECTION = [
    "_id",
    "name",
    "created_at",
    "user",
    "imported",
    "archived",
    "pathoscope",
    "nuvs",
    "group",
    "group_read",
    "group_write",
    "all_read",
    "all_write"
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


async def attempt_file_replacement(app, sample_id, user_id):
    db = app["db"]

    files = await refresh_replacements(db, sample_id)

    print(files)

    if not all([file["replacement"] for file in files]):
        print("Foobar")
        return None

    logger.info(f"Starting file replacement for sample {sample_id}")

    task_args = {
        "sample_id": sample_id
    }

    job = await virtool.db.jobs.create(
        db,
        app["settings"],
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

        if await db.samples.count(query):
            return "Sample name is already in use"

    return None


async def check_rights(db, sample_id, client, write=True):
    sample_rights = await db.samples.find_one({"_id": sample_id}, RIGHTS_PROJECTION)

    if not sample_rights:
        raise virtool.errors.DatabaseError("Sample does not exist")

    has_read, has_write = virtool.samples.get_sample_rights(sample_rights, client)

    return has_read and (write is False or has_write)


def compose_algorithm_conditions(algorithm, url_query):
    values = url_query.getall(algorithm, None)

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
                algorithm: conditions[0]
            }

        return {
            algorithm: {
                "$in": conditions
            }
        }

    return None


def compose_analysis_query(url_query):
    pathoscope = compose_algorithm_conditions("pathoscope", url_query)
    nuvs = compose_algorithm_conditions("nuvs", url_query)

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


async def recalculate_algorithm_tags(db, sample_id):
    """
    Recalculate and apply algorithm tags (eg. "ip", True) for a given sample. Finds the associated analyses and calls
    :func:`calculate_algorithm_tags`, then applies the update to the sample document.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param sample_id: the id of the sample to recalculate tags for
    :type sample_id: str

    """
    analyses = await asyncio.shield(db.analyses.find({"sample.id": sample_id}, ["ready", "algorithm"]).to_list(None))

    update = virtool.samples.calculate_algorithm_tags(analyses)

    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": update
    }, projection=LIST_PROJECTION)

    return document


async def remove_samples(db, settings, id_list):
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

    samples_path = os.path.join(settings["data_path"], "samples")

    for sample_id in id_list:
        try:
            virtool.utils.rm(os.path.join(samples_path, f"sample_{sample_id}"), recursive=True)
        except FileNotFoundError:
            pass

    return result


async def validate_force_choice_group(db, data):
    try:
        if not await db.groups.count({"_id": data["group"]}):
            return "Group does not exist"

    except KeyError:
        return "Group value required for sample creation"

    return None
