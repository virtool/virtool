import os

import pymongo

import virtool.db.subtractions
import virtool.jobs.job
import virtool.subtractions
import virtool.utils


class CreateSubtraction(virtool.jobs.job.Job):

    """
    A subclass of :class:`.Job` that adds a new host to Virtool from a passed FASTA file.

    """

    def __init__(self, *args, **task_args):
        super().__init__(*args, **task_args)

        #: The id of the host being added. Extracted from :attr:`~.virtool.job.Job.task_args`.
        self.subtraction_id = self.task_args["subtraction_id"]

        #: The path to the FASTA file being added as a host reference.
        self.fasta_path = os.path.join(
            self.settings.get("data_path"),
            "files",
            self.task_args["file_id"]
        )

        #: The path to the directory the Bowtie2 index will be written to.
        self.index_path = os.path.join(
            self.settings.get("data_path"),
            "subtractions",
            self.subtraction_id.lower().replace(" ", "_")
        )

        #: The job stages.
        self._stage_list = [
            self.mk_subtraction_dir,
            self.set_stats,
            self.bowtie_build,
            self.update_db
        ]

    async def mk_subtraction_dir(self):
        """
        Make a directory for the host index files at ``<vt_data_path>/reference/hosts/<host_id>``.

        """
        await self.run_in_executor(os.mkdir, self.index_path)

    async def set_stats(self):
        """
        Generate some stats for the FASTA file associated with this job. These numbers include nucleotide distribution,
        length distribution, and sequence count.

        """
        gc, count = await self.run_in_executor(virtool.subtractions.calculate_fasta_gc, self.fasta_path)

        await self.db.subtraction.update_one({"_id": self.subtraction_id}, {
            "$set": {
                "gc": gc,
                "count": count
            }
        })

    async def bowtie_build(self):
        """
        Call *bowtie2-build* using :meth:`~.Job.run_process` to build a Bowtie2 index for the host.

        """
        command = [
            "bowtie2-build",
            "-f",
            self.fasta_path,
            os.path.join(self.index_path, "reference")
        ]

        await self.run_subprocess(command)

    async def update_db(self):
        """
        Set the ``ready`` on the subtraction document ``True``.

        """
        await self.db.subtraction.update_one({"_id": self.subtraction_id}, {
            "$set": {
                "ready": True
            }
        })

    async def cleanup(self):
        """
        Clean up if the job process encounters an error or is cancelled. Removes the host document from the database
        and deletes any index files.

        """
        # Remove the nascent index directory and fail silently if it doesn't exist.
        try:
            await self.run_in_executor(virtool.utils.rm, self.index_path, True)
        except FileNotFoundError:
            pass

        # Remove the associated subtraction document.
        await self.db.subtraction.delete_one({"_id": self.subtraction_id})
