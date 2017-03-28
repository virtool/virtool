import os
import pymongo
import logging
import subprocess

from virtool.utils import rm

logger = logging.getLogger(__name__)


projection = [
    "_id",
    "_version",
    "description",
    "file_name",
    "ready",
    "job"
]


def to_client(document):
    document["host_id"] = document.pop("_id")
    return document


async def remove(db, settings, host_id):
    """
    Removes the host document and Bowtie2 index files identified by the passed host id.

    """
    # Don't remove the host if it is referenced by a sample.
    if await db.samples.find({"subtraction": host_id}).count():
        raise HostInUseError

    if not await db.hosts.find({"_id": host_id}).count():
        raise HostNotFoundError

    # Build the host index directory path from the host _id.
    index_path = os.path.join(settings.get("data_path"), "reference/hosts", host_id.lower().replace(" ", "_"))

    # Remove the host index directory.
    await rm(index_path, recursive=True)

    await db.hosts.remove({"_id": host_id})


async def set_stats(db, host_id, stats):
    await db.hosts.update_one({"_id": host_id}, {
        "$set": {key: stats[key] for key in ["count", "lengths", "nucleotides"]}
    })


async def set_ready(db, host_id):
    """
    Sets the ``ready`` field to ``True`` for a host document.

    """
    await db.hosts.update_one({"_id": host_id}, {
        "$set": {
            "ready": True
        }
    })


class HostNotFoundError:
    pass


class HostInUseError:
    pass


def get_bowtie2_index_names(index_path):
    """
    Returns a list of sequence ids used to generate the Bowtie2 index located at ``index_path``.

    :param index_path: the path of the Bowtie2 index to inspect.
    :type index_path: str

    :return: a list of sequence id strings.
    :rtype: list
    """
    try:
        inspect = subprocess.check_output(["bowtie2-inspect", "-n", index_path], stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        return None

    inspect_list = str(inspect, "utf-8").split("\n")
    inspect_list.remove("")

    return inspect_list


def check_collection(db_name, data_path, host="localhost", port=27017):
    db = pymongo.MongoClient(host, port)[db_name]

    response = {
        "orphaned": list(),
        "missing": list(),
        "mismatched": list()
    }

    db_hosts = db.hosts.find({}, {"count": True, "file": True})

    index_path = os.path.join(data_path, "reference/hosts")

    for host in db_hosts:
        index_ref_count = len(get_bowtie2_index_names(os.path.join(
            index_path,
            host["_id"].lower().replace(" ", "_"),
            "reference"
        )))

        if index_ref_count is None:
            response["missing"].append(host["_id"])

        elif index_ref_count != host["count"]:
            response["mismatched"].append(host["_id"])

    response["failed"] = response["missing"] or response["mismatched"]

    return response
