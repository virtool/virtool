import os
import shutil

import virtool.db
import virtool.db.caches
import virtool.db.samples
import virtool.db.sync
import virtool.jobs.fastqc
import virtool.jobs.job
import virtool.jobs.utils
import virtool.samples
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
            "srna": sample.get("srna", False),
            "subtraction_path": os.path.join(
                self.settings["data_path"],
                "subtractions",
                sample["subtraction"]["id"].lower().replace(" ", "_"),
                "reference"
            )
        })

        index_document = self.db.indexes.find_one(self.task_args["index_id"], ["manifest", "sequence_otu_map"])

        sequence_otu_map = index_document.get("sequence_otu_map", None)

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
            self.params["srna"]
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
            paths = join_legacy_read_paths(self.settings, sample)

            if paths:
                self.intermediate["qc"] = sample["quality"]
                self.params["read_paths"] = paths
                return

        if paths is None:
            cache_id = virtool.db.caches.create(
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
            paths = virtool.jobs.utils.join_read_paths(
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

            cached_read_paths = virtool.jobs.utils.join_read_paths(cache_path, paired)

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

        self.params["read_paths"] = paths

    def prepare_qc(self):
        if self.intermediate["qc"]:
            cache_id = self.intermediate.get("cache_id", None)

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

        fastqc_path = os.path.join(cache_path, "fastqc")

        os.makedirs(fastqc_path)

        virtool.jobs.fastqc.run_fastqc(
            self.run_subprocess,
            self.proc,
            self.params["read_paths"],
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


def get_trimming_parameters(paired: bool, srna: bool):
    """

    :param paired:
    :param srna:
    :return:
    """
    parameters = dict(virtool.samples.TRIM_PARAMETERS)

    if srna:
        parameters.update({
            "min_length": 20,
            "max_length": 22
        })

    if paired:
        parameters["mode"] = "any"

    return parameters


def join_legacy_read_paths(settings: dict, sample):
    """
    Create a list of paths for the read files associated with the `sample`.

    :param settings: the application settings
    :param sample: the sample document
    :return: a list of sample read paths

    """
    sample_path = virtool.db.samples.get_sample_path(settings, sample["_id"])

    if not all(f["raw"] for f in sample["files"]):
        if sample["paired"]:
            return [
                join_legacy_read_path(sample_path, 1),
                join_legacy_read_path(sample_path, 2)
            ]

        return [join_legacy_read_path(sample_path, 1)]


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


def join_legacy_read_path(sample_path: str, suffix: int) -> str:
    """
    Create a path string for a sample read file using the old file name convention (eg. reads_1.fastq).

    :param sample_path: the path to the sample directory
    :param suffix: the read file suffix
    :return: the read path

    """
    return os.path.join(sample_path, f"reads_{suffix}.fastq")
