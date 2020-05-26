import os

import pymongo

import virtool.subtractions.db
import virtool.jobs.job
import virtool.jobs.utils
import virtool.subtractions.utils
import virtool.utils


class Job(virtool.jobs.job.Job):
    """
    A subclass of :class:`.Job` that adds a new host to Virtool from a passed FASTA file.

    """

    def __init__(self, *args, **task_args):
        super().__init__(*args, **task_args)
        #: The job stages.
        self._stage_list = [
            self.make_subtraction_dir,
            self.unpack,
            self.set_stats,
            self.bowtie_build,
            self.compress
        ]

    def check_db(self):
        self.params = dict(self.task_args)

        subtraction_path = virtool.subtractions.utils.join_subtraction_path(
            self.settings,
            self.params["subtraction_id"]
        )

        self.params.update({
            "subtraction_path": subtraction_path,

            # The path to the uploaded FASTA file to be used for creating a subtraction.
            "file_path": os.path.join(
                self.settings["data_path"],
                "files",
                self.params["file_id"]
            ),

            # The path to the copied and retained FASTA file to be used for index generation.
            "fasta_path": os.path.join(
                subtraction_path,
                "subtraction.fa"
            ),

            # The root name the Bowtie2 index will be written to.
            "index_path": os.path.join(
                subtraction_path,
                "reference"
            )
        })

    def make_subtraction_dir(self):
        """
        Make a directory for the host index files at ``<vt_data_path>/reference/hosts/<host_id>``.

        """
        os.mkdir(self.params["subtraction_path"])

    def unpack(self):
        """
        Unpack the FASTA file if it is gzipped.

        """
        virtool.jobs.utils.copy_or_decompress(
            self.params["file_path"],
            self.params["fasta_path"],
            self.proc
        )

    def set_stats(self):
        """
        Generate some stats for the FASTA file associated with this job. These numbers include nucleotide distribution,
        length distribution, and sequence count.

        """
        gc, count = virtool.subtractions.utils.calculate_fasta_gc(self.params["fasta_path"])

        self.db.subtraction.find_one_and_update({"_id": self.params["subtraction_id"]}, {
            "$set": {
                "gc": gc,
                "count": count
            }
        }, return_document=pymongo.ReturnDocument.AFTER, projection=virtool.subtractions.db.PROJECTION)

        self.dispatch("subtraction", "update", [self.params["subtraction_id"]])

    def bowtie_build(self):
        """
        Call *bowtie2-build* using :meth:`~.Job.run_process` to build a Bowtie2 index for the host.

        """
        command = [
            "bowtie2-build",
            "-f",
            "--threads", str(self.proc),
            self.params["fasta_path"],
            self.params["index_path"]
        ]

        self.run_subprocess(command)

        self.db.subtraction.find_one_and_update({"_id": self.params["subtraction_id"]}, {
            "$set": {
                "ready": True
            }
        })

        self.dispatch("subtraction", "update", [self.params["subtraction_id"]])

    def compress(self):
        """
        Compress the subtraction FASTA file for long-term storage and download. Remove the uncompressed file afterwards.

        """
        virtool.utils.compress_file(
            self.params["fasta_path"],
            self.params["fasta_path"] + ".gz",
            self.proc
        )

        virtool.utils.rm(self.params["fasta_path"])

    def cleanup(self):
        """
        Clean up if the job process encounters an error or is cancelled. Removes the host document from the database
        and deletes any index files.

        """
        # Remove the nascent index directory and fail silently if it doesn't exist.
        try:
            virtool.utils.rm(self.params["subtraction_path"], True)
        except FileNotFoundError:
            pass

        # Remove the associated subtraction document.
        self.db.subtraction.delete_one({"_id": self.params["subtraction_id"]})
        self.dispatch("subtraction", "delete", [self.params["subtraction_id"]])
