import json
import os
import shutil

import pymongo.errors

import virtool.caches.db
import virtool.db
import virtool.db.sync
import virtool.jobs.fastqc
import virtool.jobs.job
import virtool.jobs.utils
import virtool.samples.db
import virtool.samples.utils
import virtool.utils
import virtool.samples.utils

TRIMMING_PROGRAM = "skewer-0.2.2"


class Job(virtool.jobs.job.Job):
    """
    A base class for all analysis job objects. Functions include:

    - establishing synchronous database connection
    - extracting task args to attributes
    - retrieving the sample and host documents
    - calculating the sample read count
    - constructing paths used by all subclasses

    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def check_db(self):
        """
        Get some initial information from the database that will be required during the course of the job.

        """
        self.params = {
            # The document id for the sample being analyzed. and the analysis document the results will be committed to.
            "sample_id": self.task_args["sample_id"],

            # The document id for the reference to analyze against.
            "ref_id": self.task_args["ref_id"],

            # The document id for the analysis being run.
            "analysis_id": self.task_args["analysis_id"],
        }

        # The document for the sample being analyzed. Assigned after database connection is made.
        sample = self.db.samples.find_one(self.params["sample_id"])

        # The parent folder for all data associated with the sample
        sample_path = os.path.join(self.settings["data_path"], "samples", self.params["sample_id"])

        self.params.update({
            # The path to the directory where all analysis result files will be written.
            "analysis_path": os.path.join(sample_path, "analysis", self.params["analysis_id"]),

            "index_path": os.path.join(
                self.settings["data_path"],
                "references",
                self.params["ref_id"],
                self.task_args["index_id"],
                "reference"
            ),

            "sample_path": sample_path,
            "paired": sample["paired"],
            #: The number of reads in the sample library. Assigned after database connection is made.
            "read_count": int(sample["quality"]["count"]),
            "library_type": sample["library_type"],
            "subtraction_path": os.path.join(
                self.settings["data_path"],
                "subtractions",
                sample["subtraction"]["id"].lower().replace(" ", "_"),
                "reference"
            )
        })

        index_document = self.db.indexes.find_one(self.task_args["index_id"], ["manifest", "sequence_otu_map"])

        sequence_otu_map = index_document.get("sequence_otu_map")

        if sequence_otu_map is None:
            sequence_otu_map = get_sequence_otu_map(self.db, index_document["manifest"])

        self.params.update({
            "manifest": index_document["manifest"],
            "sequence_otu_map": sequence_otu_map
        })

    def make_analysis_dir(self):
        """
        Make a directory for the analysis in the sample/analysis directory.

        """
        os.mkdir(self.params["analysis_path"])

    def prepare_reads(self):
        """
        Fetch cache

        """
        self.intermediate["qc"] = None

        paired = self.params["paired"]
        sample_id = self.params["sample_id"]

        parameters = get_trimming_parameters(
            paired,
            self.params["library_type"]
        )

        cache = virtool.jobs.utils.find_cache(
            self.db,
            sample_id,
            TRIMMING_PROGRAM,
            parameters
        )

        paths = None

        if cache:
            paths = virtool.jobs.utils.join_cache_read_paths(self.settings, cache)

            if paths:
                self.intermediate["cache_id"] = cache["id"]
                self.intermediate["qc"] = cache["quality"]
                self.params["read_paths"] = paths
                return

        if paths is None:
            sample = self.db.samples.find_one(sample_id)
            paths = virtool.samples.utils.join_legacy_read_paths(self.settings, sample)

            if paths:
                self.intermediate["qc"] = sample["quality"]
                self.params["read_paths"] = paths
                return

        if paths is None:
            cache_id = virtool.caches.db.create(
                self.db,
                sample_id,
                parameters,
                paired
            )

            self.dispatch("caches", "update", [cache_id])

            self.intermediate["cache_id"] = cache_id

            # The path for the nascent cache. Trimmed file will be written here.
            cache_path = virtool.jobs.utils.join_cache_path(self.settings, cache_id)

            os.makedirs(cache_path)

            # Paths for the trimmed read file(s).
            paths = virtool.samples.utils.join_read_paths(
                self.params["sample_path"],
                self.params["paired"]
            )

            command = compose_trimming_command(
                cache_path,
                parameters,
                self.proc,
                paths
            )

            env = dict(os.environ, LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu")

            self.run_subprocess(command, env=env)

            move_trimming_results(cache_path, paired)

            cached_read_paths = virtool.samples.utils.join_read_paths(cache_path, paired)

            cache_files = list()

            for index, path in enumerate(cached_read_paths):
                name = f"reads_{index + 1}.fq.gz"

                stats = virtool.utils.file_stats(path)

                cache_files.append({
                    "name": name,
                    "size": stats["size"]
                })

            self.db.caches.update_one({"_id": cache_id}, {
                "$set": {
                    "files": cache_files
                }
            })

            self.dispatch("caches", "update", [cache_id])

            self.params["read_paths"] = cached_read_paths

            return

        self.params["read_paths"] = paths

    def prepare_qc(self):
        if self.intermediate["qc"]:
            cache_id = self.intermediate.get("cache_id")

            if cache_id:
                self.db.analyses.update_one({"_id": self.params["analysis_id"]}, {
                    "$set": {
                        "cache": {
                            "id": cache_id
                        }
                    }
                })

            return

        cache_id = self.intermediate["cache_id"]

        cache_path = virtool.jobs.utils.join_cache_path(self.settings, cache_id)

        cache_paths = virtool.samples.utils.join_read_paths(cache_path, self.params["paired"])

        fastqc_path = os.path.join(cache_path, "fastqc")

        os.makedirs(fastqc_path)

        virtool.jobs.fastqc.run_fastqc(
            self.run_subprocess,
            self.proc,
            cache_paths,
            fastqc_path
        )

        qc = virtool.jobs.fastqc.parse_fastqc(fastqc_path, cache_path)

        self.intermediate["qc"] = qc

        self.db.caches.update_one({"_id": cache_id}, {
            "$set": {
                "ready": True,
                "quality": qc
            }
        })

        self.dispatch("caches", "update", [cache_id])

    def cleanup(self):
        cache_id = self.intermediate.get("cache_id")

        if cache_id:
            cache = self.db.caches.find_one(cache_id, ["ready"])

            if not cache.get("ready"):
                self.db.caches.delete_one({"_id": cache_id})
                cache_path = virtool.jobs.utils.join_cache_path(self.settings, cache_id)
                try:
                    virtool.utils.rm(cache_path, recursive=True)
                except FileNotFoundError:
                    pass

        self.db.analyses.delete_one({"_id": self.params["analysis_id"]})

        try:
            shutil.rmtree(self.params["analysis_path"])
        except FileNotFoundError:
            pass

        sample_id = self.params["sample_id"]

        virtool.db.sync.recalculate_algorithm_tags(self.db, sample_id)

        self.dispatch("samples", "update", [sample_id])


def get_sequence_otu_map(db, manifest):
    sequence_otu_map = dict()

    for otu_id, otu_version in manifest.items():
        _, patched, _ = virtool.db.sync.patch_otu_to_version(
            db,
            otu_id,
            otu_version
        )

        for isolate in patched["isolates"]:
            for sequence in isolate["sequences"]:
                sequence_id = sequence["_id"]
                sequence_otu_map[sequence_id] = patched["_id"]

    return sequence_otu_map


def move_trimming_results(path, paired):
    if paired:
        shutil.move(
            os.path.join(path, "reads-trimmed-pair1.fastq.gz"),
            os.path.join(path, "reads_1.fq.gz")
        )

        shutil.move(
            os.path.join(path, "reads-trimmed-pair2.fastq.gz"),
            os.path.join(path, "reads_2.fq.gz")
        )

    else:
        shutil.move(
            os.path.join(path, "reads-trimmed.fastq.gz"),
            os.path.join(path, "reads_1.fq.gz")
        )

    shutil.move(
        os.path.join(path, "reads-trimmed.log"),
        os.path.join(path, "trim.log")
    )


def get_trimming_parameters(paired: bool, library_type: str):
    """

    :param paired:
    :param library_type:
    :return:
    """
    parameters = dict(virtool.samples.utils.TRIM_PARAMETERS)

    if library_type == "srna":
        parameters.update({
            "min_length": 20,
            "max_length": 22
        })

    if paired:
        parameters["mode"] = "any"

    return parameters


def compose_trimming_command(cache_path: str, parameters: dict, proc, read_paths):
    command = [
        "skewer",
        "-r", str(parameters["max_error_rate"]),
        "-d", str(parameters["max_indel_rate"]),
        "-m", str(parameters["mode"]),
        "-l", str(parameters["min_length"]),
        "-q", str(parameters["end_quality"]),
        "-Q", str(parameters["mean_quality"]),
        "-t", str(proc),
        "-o", os.path.join(cache_path, "reads"),
        "-n",
        "-z",
        "--quiet"
    ]

    if parameters["max_length"]:
        command += [
            "-L", str(parameters["max_length"]),
            "-e"
        ]

    command += read_paths

    return command


def set_analysis_results(db, analysis_id, analysis_path, results):
    try:
        db.analyses.update_one({"_id": analysis_id}, {
            "$set": {
                "results": results,
                "ready": True
            }
        })
    except pymongo.errors.DocumentTooLarge:
        with open(os.path.join(analysis_path, "results.json"), "w") as f:
            json_string = json.dumps(results)
            f.write(json_string)

        db.analyses.update_one({"_id": analysis_id}, {
            "$set": {
                "results": "file",
                "ready": True
            }
        })
