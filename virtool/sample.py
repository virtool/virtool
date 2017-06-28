import os
import pymongo

import virtool.utils
import virtool.pathoscope
import virtool.job

PATHOSCOPE_TASK_NAMES = ["pathoscope_bowtie"]


LIST_PROJECTION = [
    "_id",
    "name",
    "host",
    "isolate",
    "added",
    "user_id",
    "imported",
    "archived",
    "pathoscope",
    "nuvs"
]


PROJECTION = [
    "_id",
    "name",
    "added",
    "username",
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


def processor(document):
    document = dict(document)
    document["sample_id"] = document.pop("_id")
    return document


def calculate_algorithm_tags(analyses):
    update = {
        "pathoscope": False,
        "nuvs": False
    }

    pathoscope = list()
    nuvs = list()

    for analysis in analyses:
        if analysis["algorithm"] in PATHOSCOPE_TASK_NAMES:
            pathoscope.append(analysis)

        if analysis["algorithm"] == "nuvs":
            nuvs.append(analysis)

    if len(pathoscope) > 0:
        update["pathoscope"] = any([document["ready"] for document in pathoscope]) or "ip"

    if len(nuvs) > 0:
        update["nuvs"] = any([document["ready"] for document in nuvs]) or "ip"

    return update


async def recalculate_algorithm_tags(db, sample_id):
    analyses = await db.analyses.find({"sample_id": sample_id}, ["ready", "algorithm"]).to_list(None)

    update = calculate_algorithm_tags(analyses)

    await db.samples.update({"_id": sample_id}, {
        "$set": update
    })


async def get_sample_owner(db, sample_id):
    return (await db.users.find_one(sample_id, "user_id"))["user_id"]


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
    :rtype: dict

    """
    # Remove all analysis documents associated with the sample.
    db.analyses.remove({"_id": {
        "$in": id_list
    }})

    # Remove the samples described by id_list from the database.
    result = await db.samples.remove({"_id": {
        "$in": id_list
    }})

    samples_path = os.path.join(settings.get("data_path"), "samples")

    for sample_id in id_list:
        try:
            virtool.utils.rm(os.path.join(samples_path, "sample_" + sample_id), recursive=True)
        except FileNotFoundError:
            pass

    return result
