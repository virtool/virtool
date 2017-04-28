import os
import pymongo
import logging
import subprocess

import virtool.job
import virtool.utils

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
    await virtool.utils.rm(index_path, recursive=True)

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


class AddHost(virtool.job.Job):

    """
    A subclass of :class:`.Job` that adds a new host to Virtool from a passed FASTA file. Job stages are:

    1. mk_host_dir
    2. stats
    3. bowtie_build
    4. update_db

    """

    def __init__(self, *args, **task_args):
        super(AddHost, self).__init__(*args, **task_args)

        #: The id of the host being added. Extracted from :attr:`~.virtool.job.Job.task_args`.
        self.host_id = self._task_args["_id"]

        #: The path to the FASTA file being added as a host reference.
        self.fasta_path = os.path.join(self._settings.get("data_path"), "files", self._task_args["file_id"])

        #: The path to the directory the Bowtie2 index will be written to.
        self.index_path = os.path.join(
            self._settings.get("data_path"),
            "reference/hosts",
            self.host_id.lower().replace(" ", "_")
        )

        #: The job stages.
        self.stage_list = [
            self.mk_host_dir,
            self.stats,
            self.bowtie_build,
            self.snap_build,
            self.update_db
        ]

    def mk_host_dir(self):
        """
        Make a directory for the host index files at ``<vt_data_path>/reference/hosts/<host_id>``.

        """
        os.mkdir(self.index_path)

    def stats(self):
        """
        Generate some stats for the FASTA file associated with this job. These numbers include nucleotide distribution,
        length distribution, and sequence count.

        """
        nucleotides = {
            "a": 0,
            "t": 0,
            "g": 0,
            "c": 0,
            "n": 0
        }

        count = 0
        length_list = []
        sequence = []

        # Go through the fasta file getting the nucleotide counts, lengths, and number of sequences
        with open(self.fasta_path, "r") as fasta_file:
            for line in fasta_file:
                if line[0] == ">":
                    count += 1

                    if sequence:
                        sequence = "".join(sequence)
                        length_list.append(len(sequence))

                        for i in ["a", "t", "g", "c", "n"]:
                            # Find lowercase and uppercase nucleotide characters
                            nucleotides[i] += sequence.count(i)
                            nucleotides[i] += sequence.count(i.upper())

                        sequence = []

                else:
                    sequence.append(line.rstrip())

        # Calculate the average and total length to be returned at end of function
        lengths = {
            "total": sum(length_list),
            "mean": round(sum(length_list) / len(length_list)),
            "max": max(length_list),
            "min": min(length_list)
        }

        # Reprocess the nucleotides dict to contain ratios for each nucleotide rather than counts
        nucleotides = {i: round(nucleotides[i] / lengths["total"], 3) for i in nucleotides}

        self.collection_operation("hosts", "add_stats", {"_id": self.host_id, "stats": {
            "nucleotides": nucleotides,
            "lengths": lengths,
            "count": count
        }})

    def bowtie_build(self):
        """
        Call *bowtie2-build* using :meth:`~.Job.run_process` to build a Bowtie2 index for the host.

        """
        command = [
            "bowtie2-build",
            "-f",
            self.fasta_path,
            self.index_path + "/reference"
        ]

        self.run_process(command)

    def snap_build(self):
        command = [
            "snap",
            "index",
            self.fasta_path,
            self.index_path,
            "-t" + str(self._proc)
        ]

        self.run_process(command, no_output_failure=True)

    def update_db(self):
        """
        Set the *ready* field to True by calling :meth:`.hosts.Collection.set_added`.

        """
        self.collection_operation("hosts", "set_ready", {"_id": self.host_id})

    def cleanup(self):
        """
        Clean up if the job process encounters an error or is cancelled. Removes the host document from the database.

        """
        self.collection_operation("hosts", "_remove_host", self.host_id)
