import os

import virtool.job
import virtool.virus
import virtool.virus_history
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


async def get_active_index_ids(db):
    active_indexes = set()

    async for agg in db.analyses.aggregate([{"$match": {"ready": False}}, {"$group": {"_id": "$index.id"}}]):
        active_indexes.add(agg["_id"])

    current_index_id, _ = await get_current_index(db)

    active_indexes.add(current_index_id)

    unready_index = await db.indexes.find_one({"ready": False})

    if unready_index:
        active_indexes.add(unready_index["_id"])

    try:
        active_indexes.remove("unbuilt")
    except KeyError:
        pass

    return list(active_indexes)


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


def write_fasta_dict_to_file(path, fasta_dict):
    with open(path, "w") as handle:
        for sequence_id, sequence in fasta_dict.items():
            line = ">{}\n{}\n".format(sequence_id, sequence)
            handle.write(line)


class RebuildIndex(virtool.job.Job):
    """
    Job object that rebuilds the viral Bowtie2 index from the viral sequence database.

    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self._stage_list = [
            self.mk_index_dir,
            self.write_fasta,
            self.bowtie_build,
            self.replace_old
        ]

        self.index_id = self.task_args["index_id"]

        self.reference_path = os.path.join(self.settings.get("data_path"), "reference", "viruses", self.index_id)

    @virtool.job.stage_method
    async def mk_index_dir(self):
        """
        Make dir for the new index at ``<data_path/reference/viruses/<index_id>``.

        """
        await self.run_in_executor(os.mkdir, self.reference_path)

    @virtool.job.stage_method
    async def write_fasta(self):
        """
        Generates a FASTA file of all sequences in the reference database. The FASTA headers are
        the accession numbers. These can be used to refer to full reference descriptions in the
        database after RSEM analysis and parsing

        """
        fasta_dict = dict()

        for virus_id, virus_version in self.task_args["virus_manifest"].items():
            document = await self.db.viruses.find_one(virus_id)

            if document["version"] == virus_version:
                joined = await virtool.virus.join(self.db, virus_id)
            else:
                _, joined, _ = await virtool.virus_history.patch_virus_to_version(self.db, virus_id, virus_version)

            # Extract the list of sequences from the joined patched virus.
            sequences = virtool.virus.get_default_sequences(joined)

            defaults = list()

            try:
                for sequence in sequences:
                    defaults.append(sequence["_id"])
                    fasta_dict[sequence["_id"]] = sequence["sequence"]

            except TypeError:
                raise


        fasta_path = os.path.join(self.reference_path, "ref.fa")

        await self.run_in_executor(write_fasta_dict_to_file, fasta_path, fasta_dict)

    @virtool.job.stage_method
    async def bowtie_build(self):
        """
        Run a standard bowtie-build process using the previously generated FASTA reference.
        The root name for the new reference is 'reference'

        """
        command = (
            "bowtie2-build",
            "-f",
            os.path.join(self.reference_path, "ref.fa"),
            os.path.join(self.reference_path, "reference")
        )

        await self.run_subprocess(command)

    @virtool.job.stage_method
    async def replace_old(self):
        """
        Replaces the old index with the newly generated one.

        First sets the index document field *set_ready* to `True` so the web interface will no longer show the index
        as building. Then update the *last_indexed_version* field for all virus documents. Finally, invoke
        :meth:`.job.Job.collection_operation` to call :meth:`.Collection.cleanup_index_files`. This removes any
        indexes not referred to by active sample analyses.

        """
        # Tell the client the index is ready to be used and to no longer show it as building.
        await self.db.indexes.update_one({"_id": self.index_id}, {
            "$set": {
                "ready": True
            }
        })

        active_indexes = await get_active_index_ids(self.db)

        base_path = os.path.join(self.settings.get("data_path"), "reference", "viruses")

        await self.run_in_executor(remove_unused_index_files, base_path, active_indexes)

        await self.db.indexes.update_many({"_id": {"$not": {"$in": active_indexes}}}, {
            "$set": {
                "has_files": False
            }
        })

        # Find viruses with changes.
        aggregation_cursor = self.db.viruses.aggregate([
            {"$project": {
                "version": True,
                "last_indexed_version": True,
                "comp": {"$cmp": ["$version", "$last_indexed_version"]}
            }},
            {"$match": {
                "comp": {"$ne": 0}
            }}
        ])

        async for agg in aggregation_cursor:
            await self.db.viruses.update_one({"_id": agg["_id"]}, {
                "$set": {
                    "last_indexed_version": agg["version"]
                }
            })

    @virtool.job.stage_method
    async def cleanup(self):
        """
        Cleanup if the job fails. Removes the nascent index document and change the *index_id* and *index_version*
        fields all history items being included in the new index to be 'unbuilt'.

        """
        # Remove the index document from the database.
        await self.db.indexes.delete_one({"_id": self.index_id})

        # Set all the viruses included in the build to "unbuilt" again.
        await self.db.history.update_many({"index.id": self.index_id}, {
            "$set": {
                "index": {
                    "id": "unbuilt",
                    "version": "unbuilt"
                }
            }
        })

        await self.run_in_executor(virtool.utils.rm, self.reference_path, True)
