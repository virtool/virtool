import os

import pymongo
import virtool.jobs.job

import virtool.db.subtractions
import virtool.subtractions
import virtool.utils


class Job(virtool.jobs.job.Job):

    """
    A subclass of :class:`.Job` that adds a new host to Virtool from a passed FASTA file.

    """

    def __init__(self, *args, **task_args):
        super().__init__(*args, **task_args)
        #: The job stages.
        self._stage_list = [
            self.mk_subtraction_dir,
            self.set_stats,
            self.bowtie_build,
            self.update_db
        ]

    def check_db(self):
        self.params = dict(self.task_args)

        self.params.update({
            # The path to the FASTA file being added as a host reference.
            "fasta_path": os.path.join(
                self.settings["data_path"],
                "files",
                self.params["file_id"]
            ),

            # The path to the directory the Bowtie2 index will be written to.
            "index_path": os.path.join(
                self.settings["data_path"],
                "subtractions",
                self.params["subtraction_id"].lower().replace(" ", "_")
            )
        })

    def mk_subtraction_dir(self):
        """
        Make a directory for the host index files at ``<vt_data_path>/reference/hosts/<host_id>``.

        """
        os.mkdir(self.params["index_path"])

    def set_stats(self):
        """
        Generate some stats for the FASTA file associated with this job. These numbers include nucleotide distribution,
        length distribution, and sequence count.

        """
        gc, count = virtool.subtractions.calculate_fasta_gc(self.params["fasta_path"])

        self.db.subtraction.find_one_and_update({"_id": self.params["subtraction_id"]}, {
            "$set": {
                "gc": gc,
                "count": count
            }
        }, return_document=pymongo.ReturnDocument.AFTER, projection=virtool.db.subtractions.PROJECTION)

        self.dispatch("subtraction", "update", [self.params["subtraction_id"]])

    def bowtie_build(self):
        """
        Call *bowtie2-build* using :meth:`~.Job.run_process` to build a Bowtie2 index for the host.

        """
        command = [
            "bowtie2-build",
            "-f",
            self.params["fasta_path"],
            os.path.join(self.params["index_path"], "reference")
        ]

        self.run_subprocess(command)

    def update_db(self):
        """
        Set the ``ready`` on the subtraction document ``True``.

        """
        self.db.subtraction.find_one_and_update({"_id": self.params["subtraction_id"]}, {
            "$set": {
                "ready": True
            }
        })

        self.dispatch("subtraction", "update", [self.params["subtraction_id"]])

    def cleanup(self):
        """
        Clean up if the job process encounters an error or is cancelled. Removes the host document from the database
        and deletes any index files.

        """
        # Remove the nascent index directory and fail silently if it doesn't exist.
        try:
            virtool.utils.rm(self.params["index_path"], True)
        except FileNotFoundError:
            pass

        # Remove the associated subtraction document.
        self.db.subtraction.delete_one({"_id": self.params["subtraction_id"]})

        self.dispatch("subtraction", "delete", [self.params["subtraction_id"]])
