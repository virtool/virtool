import os
import dictdiffer
import collections
from cerberus import Validator

import virtool.job
import virtool.virus
import virtool.utils
import virtool.errors

PROJECTION = [
    "_id",
    "version",
    "created_at",
    "virus_count",
    "modification_count",
    "modified_virus_count",
    "user",
    "ready",
    "has_files",
    "job"
]


async def set_stats(db, index_id, data):
    """
    Updates the index document with data describing the changes made to the virus reference since the last index
    build:

    * modification_count - the number of changes recorded since the last index build.
    * modified_virus_count - The number of viruses modified since the last index build.
    * virus_count - Number of viruses now present in the viruses collection.

    """
    v = Validator({
        "modification_count": {"type": "integer", "required": True},
        "modified_virus_count": {"type": "integer", "required": True},
        "virus_count": {"type": "integer", "required": True}
    })

    if not v(data):
        raise ValueError("data could not be validated")

    update_result = await db.indexes.update_one({"_id": index_id}, {
        "$set": data
    })

    if not update_result.modified_count:
        raise virtool.errors.DatabaseError("Could not find index '{}'".format(index_id))

    return update_result


async def set_ready(db, index_id):
    """
    Updates the index document described by the passed index id to show whether it is ready or not.

    """
    update_result = await db.indexes.update_one({"_id": index_id}, {
        "$set": {
            "ready": True
        }
    })

    if not update_result.modified_count:
        raise virtool.errors.DatabaseError("Could not find index '{}'".format(index_id))

    return update_result


async def cleanup_index_files(db, settings):
    """
    Cleans up unused index dirs. Only the **active** index (latest ready index) is ever available for running
    analysis from the web client. Any older indexes are removed from disk. If a running analysis still needs an old
    index, it cannot be removed.

    This method removes old index dirs while ensuring to retain old ones that are still references by pending
    analyses.

    """
    # The indexes (_ids) currently in use by running analysis jobs.
    retained = set()

    aggregation_cursor = db.analyses.aggregate([
        {"$match": {"ready": False}},
        {"$group": {"_id": "$index.id"}}
    ])

    async for a in aggregation_cursor:
        retained.add(a["_id"])

    current_id, _ = await get_current_index(db)

    retained.add(current_id)

    # Any rebuilding index
    unready_index = await db.indexes.find_one({"ready": False}, ["_id"])

    if unready_index:
        retained.add(unready_index["_id"])

    try:
        retained.remove("unbuilt")
    except KeyError:
        pass

    await db.indexes.update_many({"_id": {"$in": list(retained)}}, {
        "$set": {
            "has_files": False
        }
    })

    base_path = os.path.join(settings.get("data_path"), "reference", "viruses")

    for dir_name in os.listdir(base_path):
        if dir_name not in retained:
            try:
                virtool.utils.rm(os.path.join(base_path, dir_name), recursive=True)
            except OSError:
                pass


async def get_current_index_version(db):
    """
    Get the current (latest) index version number.

    """
    # Make sure only one index is in the 'ready' state.
    index_count = await db.indexes.find({"ready": True}).count()

    # Index versions start at 0. Returns -1 if no indexes exist.
    return index_count - 1


async def get_current_index(db):
    """
    Return the current index id and version number.

    """
    current_index_version = await get_current_index_version(db)

    if current_index_version == -1:
        return None

    index_id = (await db.indexes.find_one({"version": current_index_version}))["_id"]

    return index_id, current_index_version


class RebuildIndex(virtool.job.Job):
    """
    Job object that rebuilds the viral Bowtie2 index from the viral sequence database. Job stages are:

    1. mk_index_dir
    2. write_fasta
    3. bowtie_build
    4. replace_old


    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.stage_list = [
            self.mk_index_dir,
            self.write_fasta,
            self.bowtie_build,
            self.replace_old
        ]

        self.index_id = self._task_args["index_id"]

        self.reference_path = os.path.join(self._settings.get("data_path"), "reference/viruses", self.index_id)

    def get_joined_virus(self, virus_id):
        """
        Retrieve from the database the virus document associated with the passed virus_id. Then, join the virus with its
        associated sequence documents and return it.

        :param virus_id: the virus_id for which to get a joined virus.
        :type virus_id: str
        :return: the joined virus document and list of sequence documents.
        :rtype: tuple

        """
        virus = self.db.viruses.find_one({"_id": virus_id})

        if virus is None:
            return None

        # Extract the isolate_ids associated with the virus.
        isolate_ids = [isolate["isolate_id"] for isolate in virus["isolates"]]

        # Get the sequence entries associated with the isolate ids.
        sequences = list(self.db.sequences.find({"isolate_id": {"$in": isolate_ids}}))

        # Merge the sequence entries into the virus entry.
        joined = virtool.virus.merge_virus(virus, sequences)

        return joined, sequences

    def patch_virus_to_version(self, current_joined, target_version):
        """
        Patch a joined virus document to its form a specific version number.

        :param current_joined: the current joined virus document.
        :type current_joined: dict
        :param target_version: the version to patch the passed joined virus document back to.
        :type target_version: str
        :return: a joined virus document patched back to the target version.
        :rtype: dict

        """
        virus_history = self.db.history.find({"entry_id": current_joined["_id"]})

        # Sort the changes be descending entry version.
        history_documents = sorted(virus_history, key=lambda x: x["timestamp"], reverse=True)

        patched = dict(current_joined)

        if patched["_version"] != target_version:
            for history_document in history_documents:
                entry_version = history_document["entry_version"]

                if entry_version == "removed" or entry_version >= target_version:
                    if history_document["method_name"] == "add":
                        patched = "remove"

                    elif history_document["method_name"] == "remove":
                        patched = history_document["changes"]
                        break

                    else:
                        diff = dictdiffer.swap(history_document["changes"])
                        patched = dictdiffer.patch(diff, patched)
                else:
                    break

        return patched

    def mk_index_dir(self):
        """
        Make dir for the new index at ``<data_path/reference/viruses/<index_id>``.

        """
        os.mkdir(self.reference_path)

    def write_fasta(self):
        """
        Generates a FASTA file of all sequences in the reference database. The FASTA headers are
        the accession numbers. These can be used to refer to full reference descriptions in the
        database after RSEM analysis and parsing

        """
        fasta_dict = dict()

        modified_virus_count = 0

        total_found_sequences = 0

        modification_count = self.db.history.find({"index.id": self.index_id}).count()

        for virus_id, virus_version in self._task_args["virus_manifest"].items():
            current, sequences = self.get_joined_virus(virus_id) or dict()

            # A the virus joined at the correct version.
            patched = self.patch_virus_to_version(current, virus_version)

            last_indexed_version = patched["last_indexed_version"]

            if (last_indexed_version and last_indexed_version != virus_version) or last_indexed_version is None:
                modified_virus_count += 1

            # Extract the list of sequences from the joined patched virus.
            sequences = virtool.virus.get_default_sequences(patched)

            assert len(sequences) > 0

            total_found_sequences += len(sequences)

            defaults = list()

            for sequence in sequences:
                defaults.append(sequence["_id"])
                fasta_dict[sequence["_id"]] = sequence["sequence"]

        total_written_headers = 0

        # Open a new FASTA file for writing the new reference collection
        with open(os.path.join(self.reference_path, "ref.fa"), "w") as output:
            for _id, sequence in fasta_dict.items():
                sequence = "".join(sequence)
                sequence = "".join(sequence.split())
                output.write(">" + _id + "\n" + sequence + "\n")
                total_written_headers += 1

        self.collection_operation("indexes", "set_stats", {
            "_id": self.index_id,
            "virus_count": len(self._task_args["virus_manifest"]),
            "modified_virus_count": modified_virus_count,
            "modification_count": modification_count
        })

    def bowtie_build(self):
        """
        Run a standard bowtie-build process using the previously generated FASTA reference.
        The root name for the new reference is 'reference'

        """
        command = [
            "bowtie2-build",
            "-f",
            os.path.join(self.reference_path, "ref.fa"),
            os.path.join(self.reference_path, "reference")
        ]

        self.run_process(command)

    def replace_old(self):
        """
        Replaces the old index with the newly generated one.

        First sets the index document field *set_ready* to `True` so the web interface will no longer show the index
        as building. Then update the *last_indexed_version* field for all virus documents. Finally, invoke
        :meth:`.job.Job.collection_operation` to call :meth:`.Collection.cleanup_index_files`. This removes any
        indexes not referred to by active sample analyses.

        """
        # Tell the client the index is ready to be used and to no longer show it as building.
        self.collection_operation("indexes", "set_ready", {
            "_id": self.index_id,
            "ready": True
        })

        by_version = collections.defaultdict(list)

        for virus_id, virus_version in self._task_args["virus_manifest"].items():
            by_version[virus_version].append(virus_id)

        for version, virus_ids in by_version.items():
            self.collection_operation("viruses", "set_last_indexed_version", {
                "version": version,
                "ids": virus_ids
            })

        self.collection_operation("indexes", "cleanup_index_files")

    def cleanup(self):
        """
        Cleanup if the job fails. Removes the nascent index document and change the *index_id* and *index_version*
        fields all history items being included in the new index to be 'unbuilt'.

        """
        self.collection_operation("indexes", "remove", [self.index_id])

        self.collection_operation("history", "set_index_as_unbuilt", {
            "index.id": self.index_id,
            "index.version": self._task_args["index_version"]
        })


