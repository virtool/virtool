import os
import shutil

import virtool.files.db
import virtool.samples.db
import virtool.jobs.fastqc
import virtool.jobs.job
import virtool.jobs.utils
import virtool.samples.utils
import virtool.utils


class Job(virtool.jobs.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        #: The ordered list of :ref:`stage methods <stage-methods>` that are called by the job.
        self._stage_list = [
            self.make_sample_dir,
            self.copy_files,
            self.fastqc,
            self.parse_fastqc,
            self.clean_watch
        ]

    def check_db(self):
        self.params = virtool.jobs.utils.get_sample_params(
            self.db,
            self.settings,
            self.task_args
        )

    def make_sample_dir(self):
        """
        Make a data directory for the sample and a subdirectory for analyses. Read files, quality data from FastQC, and
        analysis data will be stored here.

        """
        try:
            os.makedirs(self.params["sample_path"])
            os.makedirs(self.params["analysis_path"])
            os.makedirs(self.params["fastqc_path"])
        except OSError:
            # If the path already exists, remove it and try again.
            shutil.rmtree(self.params["sample_path"])
            self.make_sample_dir()

    def copy_files(self):
        """
        Copy the files from the files directory to the nascent sample directory.

        """
        files = self.params["files"]
        sample_id = self.params["sample_id"]

        paths = [os.path.join(self.settings["data_path"], "files", file["id"]) for file in files]

        sizes = virtool.jobs.utils.copy_files_to_sample(
            paths,
            self.params["sample_path"],
            self.proc
        )

        raw = list()

        for index, file in enumerate(files):
            name = f"reads_{index + 1}.fq.gz"

            raw.append({
                "name": name,
                "download_url": f"/download/samples/{sample_id}/{name}",
                "size": sizes[index],
                "from": file,
                "raw": True
            })

        self.db.samples.update_one({"_id": sample_id}, {
            "$set": {
                "files": raw
            }
        })

    def fastqc(self):
        """
        Runs FastQC on the renamed, trimmed read files.

        """
        read_paths = virtool.samples.utils.join_read_paths(self.params["sample_path"], self.params["paired"])

        virtool.jobs.fastqc.run_fastqc(
            self.run_subprocess,
            self.proc,
            read_paths,
            self.params["fastqc_path"]
        )

    def parse_fastqc(self):
        """
        Capture the desired data from the FastQC output. The data is added to the samples database
        in the main run() method

        """
        qc = virtool.jobs.fastqc.parse_fastqc(self.params["fastqc_path"], self.params["sample_path"])

        self.db.samples.update_one({"_id": self.params["sample_id"]}, {
            "$set": {
                "quality": qc,
                "imported": False
            }
        })

        self.dispatch("samples", "update", [self.params["sample_id"]])

    def clean_watch(self):
        """ Remove the original read files from the files directory """
        file_ids = [f["id"] for f in self.params["files"]]
        self.db.files.delete_many({"_id": {"$in": file_ids}})
        self.dispatch("files", "delete", self.params["files"])

    def cleanup(self):
        for file_id in self.params["files"]:
            self.db.files.update_many({"_id": file_id}, {
                "$set": {
                    "reserved": False
                }
            })

        self.dispatch("files", "update", self.params["files"])

        try:
            shutil.rmtree(self.params["sample_path"])
        except FileNotFoundError:
            pass

        self.db.samples.delete_one({"_id": self.params["sample_id"]})

        self.dispatch("samples", "delete", [self.params["sample_id"]])
