import json
import os
import pathlib
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
import virtool.samples.utils
import virtool.utils

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

        analysis_path = os.path.join(sample_path, "analysis", self.params["analysis_id"])

        analysis = self.db.analyses.find_one(self.params["analysis_id"], ["subtraction"])

        self.params.update({
            # The path to the directory where all analysis result files will be written.
            "analysis_path": analysis_path,

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
            "sample_read_length": int(sample["quality"]["length"][1]),
            "library_type": sample["library_type"],
            "reads_path": os.path.join(analysis_path, "_reads"),
            "subtraction_path": os.path.join(
                self.settings["data_path"],
                "subtractions",
                analysis["subtraction"]["id"].lower().replace(" ", "_"),
                "reference"
            )
        })

        index_info = get_index_info(
            self.db,
            self.settings,
            self.task_args["index_id"]
        )

        self.params.update(index_info)

        read_paths = [os.path.join(self.params["reads_path"], "reads_1.fq.gz")]

        if self.params["paired"]:
            read_paths.append(os.path.join(self.params["reads_path"], "reads_2.fq.gz"))

        self.params["read_paths"] = read_paths

    def make_analysis_dir(self):
        """
        Make a directory for the analysis in the sample/analysis directory.

        """
        os.mkdir(self.params["analysis_path"])

    def prepare_reads(self):
        """
        Fetch cache

        """
        os.makedirs(self.params["reads_path"])

        paired = self.params["paired"]

        parameters = get_trimming_parameters(
            paired,
            self.params["library_type"],
            self.params["sample_read_length"]
        )

        cache = virtool.jobs.utils.find_cache(
            self.db,
            self.params["sample_id"],
            TRIMMING_PROGRAM,
            parameters
        )

        if cache:
            return self._fetch_cache(cache)

        sample = self.db.samples.find_one(self.params["sample_id"])
        paths = virtool.samples.utils.join_legacy_read_paths(self.settings, sample)

        if paths:
            return self._fetch_legacy(paths)

        return self._create_cache(parameters)

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

        virtool.db.sync.recalculate_workflow_tags(self.db, sample_id)

        self.dispatch("samples", "update", [sample_id])

    def _create_cache(self, parameters):
        cache = virtool.caches.db.create(
            self.db,
            self.params["sample_id"],
            parameters,
            self.params["paired"]
        )

        cache_id = cache["id"]

        self.dispatch("caches", "update", [cache_id])
        self._set_cache_id(cache_id)

        # The path for the nascent cache. Trimmed file will be written here.
        cache_path = virtool.jobs.utils.join_cache_path(self.settings, cache_id)
        os.makedirs(cache_path)

        # A path to perform the trimming and QC in. Local to the analysis.
        temp_cache_path = os.path.join(self.params["analysis_path"], "_cache")
        os.makedirs(temp_cache_path)

        # Paths for the sample read file(s).
        paths = virtool.samples.utils.join_read_paths(
            self.params["sample_path"],
            self.params["paired"]
        )

        # Don't compress output if it is going to converted to FASTA.
        command = compose_trimming_command(
            temp_cache_path,
            parameters,
            self.proc,
            paths
        )

        env = dict(os.environ, LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu")

        self.run_subprocess(command, env=env)

        rename_trimming_results(temp_cache_path)

        self._run_cache_qc(cache_id, temp_cache_path)

        copy_trimming_results(temp_cache_path, cache_path)

        self._set_cache_stats(cache)
        self._use_new_cache(temp_cache_path)

    def _fetch_cache(self, cache):
        cached_read_paths = virtool.jobs.utils.join_cache_read_paths(self.settings, cache)

        for path in cached_read_paths:
            local_path = os.path.join(self.params["reads_path"], pathlib.Path(path).name)
            shutil.copy(path, local_path)

        self._set_cache_id(cache["id"])

    def _fetch_legacy(self, legacy_read_paths):
        for path in legacy_read_paths:
            local_path = os.path.join(self.params["reads_path"], pathlib.Path(path).name)
            shutil.copy(path, local_path)

    def _run_cache_qc(self, cache_id, temp_path):
        fastqc_path = os.path.join(temp_path, "fastqc")

        os.makedirs(fastqc_path)

        read_paths = [os.path.join(temp_path, "reads_1.fq.gz")]

        if self.params["paired"]:
            read_paths.append(os.path.join(temp_path, "reads_2.fq.gz"))

        virtool.jobs.fastqc.run_fastqc(
            self.run_subprocess,
            self.proc,
            read_paths,
            fastqc_path
        )

        qc = virtool.jobs.fastqc.parse_fastqc(fastqc_path, self.params["sample_path"])

        self.db.caches.update_one({"_id": cache_id}, {
            "$set": {
                "quality": qc
            }
        })

        self.dispatch("caches", "update", [cache_id])

    def _set_cache_id(self, cache_id):
        self.intermediate["cache_id"] = cache_id

        self.db.analyses.update_one({"_id": self.params["analysis_id"]}, {
            "$set": {
                "cache": {
                    "id": cache_id
                }
            }
        })

        self.dispatch("analyses", "update", [self.params["analysis_id"]])

    def _set_cache_stats(self, cache):
        paths = virtool.jobs.utils.join_cache_read_paths(self.settings, cache)
        cache_files = list()

        for path in paths:
            name = pathlib.Path(path).name
            stats = virtool.utils.file_stats(path)

            cache_files.append({
                "name": name,
                "size": stats["size"]
            })

        self.db.caches.update_one({"_id": cache["id"]}, {
            "$set": {
                "files": cache_files,
                "ready": True
            }
        })

    def _use_new_cache(self, temp_cache_path):
        names = ["reads_1.fq.gz"]

        if self.params["paired"]:
            names.append("reads_2.fq.gz")

        for name in names:
            shutil.move(
                os.path.join(temp_cache_path, name),
                os.path.join(self.params["reads_path"], name)
            )

        shutil.rmtree(temp_cache_path)


def get_sequence_otu_map(db, settings, manifest):
    sequence_otu_map = dict()

    for otu_id, otu_version in manifest.items():
        _, patched, _ = virtool.db.sync.patch_otu_to_version(
            db,
            settings,
            otu_id,
            otu_version
        )

        for isolate in patched["isolates"]:
            for sequence in isolate["sequences"]:
                sequence_id = sequence["_id"]
                sequence_otu_map[sequence_id] = patched["_id"]

    return sequence_otu_map


def copy_trimming_results(src, dest):
    shutil.copy(
        os.path.join(src, "reads_1.fq.gz"),
        dest
    )

    try:
        shutil.copy(
            os.path.join(src, "reads_2.fq.gz"),
            dest
        )
    except FileNotFoundError:
        pass


def rename_trimming_results(path):
    """
    Rename Skewer output to a simple name used in Virtool.

    :param path:
    :return:

    """
    try:
        shutil.move(
            os.path.join(path, f"reads-trimmed.fastq.gz"),
            os.path.join(path, f"reads_1.fq.gz")
        )
    except FileNotFoundError:
        shutil.move(
            os.path.join(path, f"reads-trimmed-pair1.fastq.gz"),
            os.path.join(path, f"reads_1.fq.gz")
        )

        shutil.move(
            os.path.join(path, f"reads-trimmed-pair2.fastq.gz"),
            os.path.join(path, f"reads_2.fq.gz")
        )

    shutil.move(
        os.path.join(path, "reads-trimmed.log"),
        os.path.join(path, "trim.log")
    )


def get_trimming_min_length(library_type, sample_read_length) -> int:
    if library_type == "amplicon":
        return round(0.95 * sample_read_length)

    if sample_read_length < 80:
        return 35

    if sample_read_length < 160:
        return 100

    return 160


def get_trimming_parameters(paired: bool, library_type: str, sample_read_length: int):
    """

    :param paired:
    :param library_type:
    :param sample_read_length:
    :return:

    """
    min_length = get_trimming_min_length(library_type, sample_read_length)

    if library_type == "amplicon":
        return {
            **virtool.samples.utils.TRIM_PARAMETERS,
            "end_quality": 0,
            "mean_quality": 0,
            "min_length": min_length
        }

    if library_type == "srna":
        return {
            **virtool.samples.utils.TRIM_PARAMETERS,
            "min_length": 20,
            "max_length": 22
        }

    return {
        **virtool.samples.utils.TRIM_PARAMETERS,
        "min_length": min_length
    }


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


def get_index_info(db, settings, index_id):
    document = db.indexes.find_one(index_id, ["manifest", "sequence_otu_map"])

    try:
        sequence_otu_map = document["sequence_otu_map"]
    except KeyError:
        sequence_otu_map = get_sequence_otu_map(
            db,
            settings,
            document["manifest"]
        )

    return {
        "manifest": document["manifest"],
        "sequence_otu_map": sequence_otu_map
    }


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
