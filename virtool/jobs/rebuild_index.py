import os
import logging
import dictdiffer
from collections import defaultdict

from virtool.jobs.job import Job
from virtool.viruses import merge_virus


logger = logging.getLogger(__name__)


class RebuildIndex(Job):
    """
    Job object that rebuilds the viral Bowtie2 index from the viral sequence database. Job stages are:

    1. mk_index_dir
    2. write_fasta
    3. bowtie_build
    4. snap_build
    5. replace_old


    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.stage_list = [
            self.mk_index_dir,
            self.write_fasta,
            self.bowtie_build,
            self.snap_build,
            self.replace_old
        ]

        self.index_id = self.task_args["index_id"]

        self.reference_path = os.path.join(self.settings.get("data_path"), "reference/viruses", self.index_id)

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
        joined = merge_virus(virus, sequences)

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

        modification_count = self.db.history.find({"index": self.index_id}).count()

        for virus_id, virus_version in self.task_args["virus_manifest"].items():
            current, sequences = self.get_joined_virus(virus_id) or dict()

            # A the virus joined at the correct version.
            patched = self.patch_virus_to_version(current, virus_version)

            last_indexed_version = patched["last_indexed_version"]

            if (last_indexed_version and last_indexed_version != virus_version) or last_indexed_version is None:
                modified_virus_count += 1

            # Extract the list of sequences from the joined patched virus.
            sequences = get_default_sequences(patched)

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
            "virus_count": len(self.task_args["virus_manifest"]),
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

    def snap_build(self):
        """
        Run a standard snap build process using the previously generated FASTA reference.
        The root name for the new reference is 'reference'

        """
        command = [
            "snap",
            "index",
            os.path.join(self.reference_path, "ref.fa"),
            self.reference_path + "/",
            "-t" + str(self.proc)
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

        by_version = defaultdict(list)

        for virus_id, virus_version in self.task_args["virus_manifest"].items():
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
            "index_id": self.index_id,
            "index_version": self.task_args["index_version"]
        })


def get_default_sequences(joined_document):
    """
    Return a list of sequences from the default isolate of the passed joined virus document.

    :param joined_document: the joined virus document.
    :type joined_document: dict
    :return: a list of sequences associated with the default isolate.
    :rtype: list

    """
    for isolate in joined_document["isolates"]:
        if isolate["default"]:
            return isolate["sequences"]
