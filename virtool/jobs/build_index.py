import os

import virtool.db.history
import virtool.db.indexes
import virtool.db.otus
import virtool.errors
import virtool.history
import virtool.jobs.job
import virtool.otus
import virtool.utils


class BuildIndex(virtool.jobs.job.Job):
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

        self.ref_id = self.task_args["ref_id"]
        self.index_id = self.task_args["index_id"]

        self.reference_path = os.path.join(
            self.settings["data_path"],
            "references",
            self.ref_id
        )

        self.index_path = os.path.join(self.reference_path, self.index_id)

    @virtool.jobs.job.stage_method
    async def mk_index_dir(self):
        """
        Make dir for the new index at ``<data_path/references/<index_id>``.

        """
        try:
            os.mkdir(self.reference_path)
        except FileExistsError:
            pass

        await os.mkdir(self.index_path)

    @virtool.jobs.job.stage_method
    async def write_fasta(self):
        """
        Generates a FASTA file of all sequences in the reference database. The FASTA headers are
        the accession numbers. These can be used to refer to full reference descriptions in the
        database after RSEM analysis and parsing

        """
        fasta_dict = dict()

        for patch_id, patch_version in self.task_args["manifest"].items():
            document = await self.db.otus.find_one(patch_id)

            if document["version"] == patch_version:
                joined = await virtool.db.otus.join(self.db, patch_id)
            else:
                _, joined, _ = await virtool.db.history.patch_to_version(self.db, patch_id, patch_version)

            # Extract the list of sequences from the joined patched patch.
            sequences = virtool.otus.extract_default_sequences(joined)

            defaults = list()

            try:
                for sequence in sequences:
                    defaults.append(sequence["_id"])
                    fasta_dict[sequence["_id"]] = sequence["sequence"]

            except TypeError:
                raise

        fasta_path = os.path.join(self.index_path, "ref.fa")

        await write_fasta_dict_to_file(fasta_path, fasta_dict)

    @virtool.jobs.job.stage_method
    async def bowtie_build(self):
        """
        Run a standard bowtie-build process using the previously generated FASTA reference.
        The root name for the new reference is 'reference'

        """
        command = (
            "bowtie2-build",
            "-f",
            os.path.join(self.index_path, "ref.fa"),
            os.path.join(self.index_path, "reference")
        )

        await self.run_subprocess(command)

    @virtool.jobs.job.stage_method
    async def replace_old(self):
        """
        Replaces the old index with the newly generated one.

        """
        # Tell the client the index is ready to be used and to no longer show it as building.
        await self.db.indexes.update_one({"_id": self.index_id}, {
            "$set": {
                "ready": True
            }
        })

        active_indexes = await virtool.db.indexes.get_active_index_ids(self.db, self.ref_id)

        base_path = os.path.join(
            self.settings["data_path"],
            "references",
            self.ref_id
        )

        remove_unused_index_files(base_path, active_indexes)

        await self.db.indexes.update_many({"_id": {"$not": {"$in": active_indexes}}}, {
            "$set": {
                "has_files": False
            }
        })

        # Find otus with changes.
        pipeline = [
            {"$project": {
                "reference": True,
                "version": True,
                "last_indexed_version": True,
                "comp": {"$cmp": ["$version", "$last_indexed_version"]}
            }},
            {"$match": {
                "reference.id": self.ref_id,
                "comp": {"$ne": 0}
            }}
        ]

        async for agg in self.db.otus.aggregate(pipeline):
            await self.db.otus.update_one({"_id": agg["_id"]}, {
                "$set": {
                    "last_indexed_version": agg["version"]
                }
            })

    @virtool.jobs.job.stage_method
    async def cleanup(self):
        """
        Cleanup if the job fails. Removes the nascent index document and change the *index_id* and *index_version*
        fields all history items being included in the new index to be 'unbuilt'.

        """
        # Remove the index document from the database.
        await self.db.indexes.delete_one({"_id": self.index_id})

        # Set all the otus included in the build to "unbuilt" again.
        await self.db.history.update_many({"index.id": self.index_id}, {
            "$set": {
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                }
            }
        })

        virtool.utils.rm(self.index_path, True)


def remove_unused_index_files(base_path, retained):
    """
    Cleans up unused index dirs. Only the **active** index (latest ready index) is ever available for running
    analysis from the web client. Any older indexes are removed from disk. If a running analysis still needs an old
    index, it cannot be removed.

    This method removes old index dirs while ensuring to retain old ones that are still references by pending
    analyses.

    """
    for dir_name in os.listdir(base_path):
        if dir_name not in retained:
            try:
                virtool.utils.rm(os.path.join(base_path, dir_name), recursive=True)
            except OSError:
                pass


def write_fasta_dict_to_file(path, fasta_dict):
    with open(path, "w") as handle:
        for sequence_id, sequence in fasta_dict.items():
            line = ">{}\n{}\n".format(sequence_id, sequence)
            handle.write(line)
