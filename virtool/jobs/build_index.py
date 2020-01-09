import os
import typing

import virtool.history.db
import virtool.indexes.db
import virtool.otus.db
import virtool.db.sync
import virtool.errors
import virtool.history.utils
import virtool.jobs.job
import virtool.otus.utils
import virtool.utils


class Job(virtool.jobs.job.Job):
    """
    Job object that builds a new Bowtie2 index for a given reference.

    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self._stage_list = [
            self.mk_index_dir,
            self.write_fasta,
            self.bowtie_build,
            self.replace_old
        ]

    def check_db(self):
        """
        Get job information from the database.

        """
        self.params = dict(self.task_args)

        self.params["reference_path"] = os.path.join(
            self.settings["data_path"],
            "references",
            self.params["ref_id"]
        )

        self.params["index_path"] = os.path.join(
            self.params["reference_path"],
            self.params["index_id"]
        )

        document = self.db.references.find_one(self.params["ref_id"], ["data_type"])

        self.params["data_type"] = document["data_type"]

    def mk_index_dir(self):
        """
        Make dir for the new index at ``<data_path/references/<index_id>``.

        """
        try:
            os.makedirs(self.params["index_path"])
        except FileExistsError:
            pass

    def write_fasta(self):
        """
        Generates a FASTA file of all sequences in the reference database. The FASTA headers are
        the accession numbers.

        """
        patched_otus = get_patched_otus(
            self.db,
            self.settings,
            self.params["manifest"]
        )

        sequence_otu_map = dict()

        sequences = get_sequences_from_patched_otus(
            patched_otus,
            self.params["data_type"],
            sequence_otu_map
        )

        fasta_path = os.path.join(self.params["index_path"], "ref.fa")

        write_sequences_to_file(fasta_path, sequences)

        index_id = self.params["index_id"]

        self.db.indexes.update_one({"_id": index_id}, {
            "$set": {
                "sequence_otu_map": sequence_otu_map
            }
        })

        self.dispatch("indexes", "update", [index_id])

    def bowtie_build(self):
        """
        Run a standard bowtie-build process using the previously generated FASTA reference.
        The root name for the new reference is 'reference'

        """
        if self.params["data_type"] != "barcode":
            command = [
                "bowtie2-build",
                "-f",
                "--threads", str(self.proc),
                os.path.join(self.params["index_path"], "ref.fa"),
                os.path.join(self.params["index_path"], "reference")
            ]

            self.run_subprocess(command)

    def replace_old(self):
        """
        Replaces the old index with the newly generated one.

        """
        # Tell the client the index is ready to be used and to no longer show it as building.
        self.db.indexes.find_one_and_update({"_id": self.params["index_id"]}, {
            "$set": {
                "ready": True
            }
        })

        self.dispatch("indexes", "update", [self.params["index_id"]])

        active_indexes = virtool.db.sync.get_active_index_ids(self.db, self.params["ref_id"])

        remove_unused_index_files(self.params["reference_path"], active_indexes)

        query = {
            "_id": {
                "$not": {
                    "$in": active_indexes
                }
            }
        }

        self.db.indexes.update_many(query, {
            "$set": {
                "has_files": False
            }
        })

        id_list = self.db.indexes.distinct("_id", query)

        self.dispatch("indexes", "update", id_list)

        # Find OTUs with changes.
        pipeline = [
            {"$project": {
                "reference": True,
                "version": True,
                "last_indexed_version": True,
                "comp": {"$cmp": ["$version", "$last_indexed_version"]}
            }},
            {"$match": {
                "reference.id": self.params["ref_id"],
                "comp": {"$ne": 0}
            }},
            {"$group": {
                "_id": "$version",
                "id_list": {
                    "$addToSet": "$_id"
                }
            }}
        ]

        id_version_key = {agg["_id"]: agg["id_list"] for agg in self.db.otus.aggregate(pipeline)}

        # For each version number
        for version, id_list in id_version_key.items():
            self.db.otus.update_many({"_id": {"$in": id_list}}, {
                "$set": {
                    "last_indexed_version": version
                }
            })

    def cleanup(self):
        """
        Cleanup if the job fails.

        Removes the nascent index document and change the *index_id* and *index_version*
        fields all history items being included in the new index to be 'unbuilt'.

        """
        index_id = self.params["index_id"]

        # Remove the index document from the database.
        self.db.indexes.delete_one({"_id": index_id})

        self.dispatch("indexes", "delete", [index_id])

        query = {
            "_id": {
                "$in": self.db.history.distinct("_id", {"index.id": index_id})
            }
        }

        # Set all the otus included in the build to "unbuilt" again.
        self.db.history.update_many(query, {
            "$set": {
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                }
            }
        })

        id_list = self.db.history.distinct("_id", query)

        self.dispatch("history", "update", id_list)

        virtool.utils.rm(self.params["index_path"], True)


def get_patched_otus(db, settings: dict, manifest: dict) -> typing.Generator[dict, None, None]:
    """
    Get joined OTUs patched to a specific version based on a manifest of OTU ids and versions.

    :param db: the job database client
    :param settings: the application settings
    :param manifest: the manifest

    """
    for patch_id, patch_version in manifest.items():
        _, joined, _ = virtool.db.sync.patch_otu_to_version(
            db,
            settings,
            patch_id,
            patch_version
        )

        yield joined


def get_sequences_from_patched_otus(otus: typing.Iterable[dict], data_type: str, sequence_otu_map: dict) -> typing.Generator[dict, None, None]:
    """
    Return sequence documents based on an `Iterable` of joined OTU documents. Writes a map of sequence IDs to OTU IDs
    into the passed `sequence_otu_map`.

    If `data_type` is `barcode`, all sequences are returned. Otherwise, only sequences of default isolates are returned.

    :param otus: an Iterable of joined OTU documents
    :param data_type: the data type of the parent reference for the OTUs
    :param sequence_otu_map: a dict to populate with sequence-OTU map information
    :return: a generator that yields sequence documents

    """
    for otu in otus:
        otu_id = otu["_id"]

        for isolate in otu["isolates"]:
            for sequence in isolate["sequences"]:
                sequence_id = sequence["_id"]
                sequence_otu_map[sequence_id] = otu_id

        if data_type == "barcode":
            for sequence in virtool.otus.utils.extract_sequences(otu):
                yield sequence
        else:
            for sequence in virtool.otus.utils.extract_default_sequences(otu):
                yield sequence


def remove_unused_index_files(reference_path: str, active_index_ids: list):
    """
    Cleans up unused index files for a reference given it's path.

    Only the **active** index (latest ready index) is available for running analysis from the web client. Any older
    indexes are removed from disk. If a running analysis still needs an old index, it will not be removed.

    :param reference_path: the path to the reference
    :param active_index_ids: ids of indexes that are still in use by analysis jobs

    """
    for index_id in os.listdir(reference_path):
        if index_id not in active_index_ids:
            try:
                virtool.utils.rm(os.path.join(reference_path, index_id), recursive=True)
            except FileNotFoundError:
                pass


def write_sequences_to_file(path: str, sequences: typing.Iterable):
    """
    Write a FASTA file based on a given `Iterable` containing sequence documents.

    Headers will contain the `_id` field of the document and the sequence text is from the `sequence` field.

    :param path: the path to write the file to
    :param sequences: the sequences to write to file

    """
    with open(path, "w") as handle:
        for sequence in sequences:
            sequence_id = sequence["_id"]
            sequence_data = sequence["sequence"]

            line = f">{sequence_id}\n{sequence_data}\n"
            handle.write(line)
