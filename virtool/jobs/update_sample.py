import os

import virtool.db.caches
import virtool.db.files
import virtool.db.samples
import virtool.jobs.fastqc
import virtool.jobs.job
import virtool.jobs.utils
import virtool.samples
import virtool.utils
import virtool.samples


class Job(virtool.jobs.job.Job):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        #: The ordered list of :ref:`stage methods <stage-methods>` that are called by the job.
        self._stage_list = [
            self.copy_files,
            self.fastqc,
            self.parse_fastqc,
            self.create_cache,
            self.replace_old
        ]

    def check_db(self):
        self.params = virtool.jobs.utils.get_sample_params(
            self.db,
            self.settings,
            self.task_args
        )

    def copy_files(self):
        """
        Copy the replacement files from the files directory to the sample directory.

        The files are named replacement_reads_<suffix>.fq.gz. They will be compressed if necessary.

        """
        files = self.params["files"]
        sample_id = self.params["sample_id"]
        paired = self.params["paired"]

        paths = [os.path.join(self.settings["data_path"], "files", file["replacement"]["id"]) for file in files]

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
                "from": file
            })

        self.intermediate["raw"] = raw

    def fastqc(self):
        """
        Runs FastQC on the replacement read files.

        """
        fastq_path = self.params["fastqc_path"]

        try:
            virtool.utils.rm(fastq_path, recursive=True)
        except FileNotFoundError:
            pass

        os.mkdir(fastq_path)

        paths = virtool.jobs.utils.join_read_paths(
            self.params["sample_path"],
            self.params["paired"]
        )

        virtool.jobs.fastqc.run_fastqc(
            self.run_subprocess,
            self.proc,
            paths,
            fastq_path
        )

    def parse_fastqc(self):
        """
        Capture the desired data from the FastQC output. The data is added to the samples database
        in the main run() method

        """
        self.intermediate["qc"] = virtool.jobs.fastqc.parse_fastqc(
            self.params["fastqc_path"],
            self.params["sample_path"],
            prefix="replacement_fastqc_"
        )

    def create_cache(self):
        """
        Create a cache from the old sample files.

        These files constitute a valid cache because they were trimmed in the original CreateSample job.

        """
        sample_id = self.params["sample_id"]

        self.intermediate["cache_id"] = virtool.db.caches.create(
            self.db,
            sample_id,
            virtool.samples.LEGACY_TRIM_PARAMETERS,
            self.params["paired"],
            legacy=True
        )

        cache_id = self.intermediate["cache_id"]

        self.dispatch("caches", "insert", [cache_id])

        files = list()

        cache_path = virtool.jobs.utils.join_cache_path(self.settings, cache_id)

        os.makedirs(cache_path)

        for index, file in enumerate(self.params["files"]):
            path = os.path.join(self.params["sample_path"], file["name"])

            name = f"reads_{index + 1}.fq.gz"

            target = os.path.join(cache_path, name)

            virtool.jobs.utils.copy_or_compress(path, target, self.proc)

            stats = virtool.utils.file_stats(target)

            files.append({
                "name": name,
                "size": stats["size"]
            })

        self.db.caches.update_one({"_id": cache_id}, {
            "$set": {
                "ready": True,
                "files": files,
                "quality": self.params["document"]["quality"]
            }
        })

        self.dispatch("caches", "update", [cache_id])

        analysis_query = {"sample.id": sample_id}

        self.db.analyses.update_many(analysis_query, {
            "$set": {
                "cache": {
                    "id": cache_id
                }
            }
        })

        analysis_ids = self.db.analyses.distinct("_id", analysis_query)

        self.dispatch("analyses", "update", analysis_ids)

    def replace_old(self):
        sample_id = self.params["sample_id"]

        files = list()

        # Prepare new list for `files` field in sample document.
        for index, file in enumerate(self.params["files"]):
            name = f"reads_{index + 1}.fq.gz"

            path = os.path.join(self.params["sample_path"], name)

            stats = virtool.utils.file_stats(path)

            files.append({
                "name": name,
                "download_url": f"/download/samples/{sample_id}/{name}",
                "size": stats["size"],
                "from": file["replacement"],
                "raw": True
            })

        # Set new files as primary files for sample. Add prune flag, which will cause old files to be automatically
        # removed when they are no longer in use by running analyses.
        self.db.samples.update_one({"_id": self.params["sample_id"]}, {
            "$set": {
                "files": files,
                "prune": True,
                "quality": self.intermediate["qc"]
            }
        })

        self.dispatch("samples", "update", [self.params["sample_id"]])

    def cleanup(self):
        # Remove cache
        cache_id = self.intermediate.get("cache_id")

        if cache_id:
            self.db.delete_one({"_id": cache_id})
            cache_path = virtool.jobs.utils.join_cache_path(self.settings, cache_id)
            self.dispatch("caches", "delete", [cache_id])

            # Remove cache directory.
            try:
                virtool.utils.rm(cache_path, recursive=True)
            except FileNotFoundError:
                pass

        sample_id = self.params["sample_id"]

        # Undo analysis cache field addition.
        analysis_query = {"sample.id": sample_id}

        self.db.analyses.update_many(analysis_query, {
            "$unset": {
                "cache": ""
            }
        })
        analysis_ids = self.db.analyses.distinct("_id", analysis_query)
        self.dispatch("analyses", "update", analysis_ids)

        # Undo sample document changes.
        self.db.samples.update_one({"_id": sample_id}, {
            "$set": {
                # Use old files and quality fields.
                "files": self.params["files"],
                "quality": self.params["document"]["quality"]
            },
            "$unset": {
                "prune": "",
                "update_job": ""
            }
        })
        self.dispatch("samples", "update", [sample_id])

        # Remove sample files.
        paths = virtool.jobs.utils.join_read_paths(self.params["sample_path"], paired=True)

        for path in paths:
            try:
                virtool.utils.rm(path)
            except FileNotFoundError:
                pass
