import os
import pymongo

import virtool.utils
import virtool.pathoscope
import virtool.job

PATHOSCOPE_TASK_NAMES = [
    "pathoscope_bowtie",
    "pathoscope_barracuda"
]


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


def calculate_algorithm_tags(analyses):
    """
    Calculate the algorithm tags (eg. "ip", True) that should be applied to a sample document based on a list of its
    associated analyses.

    :param analyses: the analyses to calculate tags for
    :type analyses: list

    :return: algorithm tags to apply to the sample document
    :rtype: dict

    """
    pathoscope = False
    nuvs = False

    for analysis in analyses:
        if pathoscope is not True and analysis["algorithm"] in PATHOSCOPE_TASK_NAMES:
            pathoscope = analysis["ready"] or "ip" or pathoscope

        if nuvs is not True and analysis["algorithm"] == "nuvs":
            nuvs = analysis["ready"] or "ip" or nuvs

        if pathoscope is True and nuvs is True:
            break

    return {
        "pathoscope": pathoscope,
        "nuvs": nuvs
    }


async def recalculate_algorithm_tags(db, sample_id):
    """
    Recalculate and apply algorithm tags (eg. "ip", True) for a given sample. Finds the associated analyses and calls
    :func:`calculate_algorithm_tags`, then applies the update to the sample document.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param sample_id: the id of the sample to recalculate tags for
    :type sample_id: str

    """
    analyses = await db.analyses.find({"sample.id": sample_id}, ["ready", "algorithm"]).to_list(None)

    update = calculate_algorithm_tags(analyses)

    document = await db.samples.find_one_and_update({"_id": sample_id}, {
        "$set": update
    }, return_document=pymongo.ReturnDocument.AFTER, projection=LIST_PROJECTION)

    return document


async def get_sample_owner(db, sample_id):
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


async def remove_samples(db, settings, id_list):
    """
    Complete removes the samples identified by the document ids in ``id_list``. In order, it:

    - removes all analyses associated with the sample from the analyses collection
    - removes the sample from the samples collection
    - removes the sample directory from the file system
    
    :param db: a Motor client
    :type db: :class:`.motor.motor_asyncio.AsyncIOMotorClient``
    
    :param settings: a Virtool settings object
    :type settings: :class:`.Settings`

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

    samples_path = os.path.join(settings.get("data_path"), "samples")

    for sample_id in id_list:
        try:
            virtool.utils.rm(os.path.join(samples_path, "sample_{}".format(sample_id)), recursive=True)
        except FileNotFoundError:
            pass

    return result
