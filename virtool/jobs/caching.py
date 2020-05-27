"""
Functions for creating read caches when running analyses.

"""
import asyncio
import logging
import os
import pathlib
import shutil

import virtool.caches.db
import virtool.jobs.fastqc
import virtool.jobs.utils
import virtool.samples.utils
import virtool.utils

logger = logging.getLogger(__name__)


async def create_cache(job, parameters):
    logger.debug("Creating new cache in database")
    cache = await virtool.caches.db.create(
        job.db,
        job.params["sample_id"],
        parameters,
        job.params["paired"]
    )

    cache_id = cache["id"]

    await set_cache_id(job, cache_id)

    logger.debug("Fetching raw sample data to build cache")
    paths = await fetch_raw(job)

    logger.debug("Creating temporary cache directory")
    await job.run_in_executor(
        os.makedirs,
        job.params["temp_cache_path"]
    )

    # Don't compress output if it is going to converted to FASTA.
    command = compose_trimming_command(
        job.params["temp_cache_path"],
        parameters,
        job.proc,
        paths
    )

    env = dict(os.environ, LD_LIBRARY_PATH="/usr/lib/x86_64-linux-gnu")

    await job.run_subprocess(command, env=env)

    logger.debug("Renaming trimming results")
    await job.run_in_executor(
        rename_trimming_results,
        job.params["temp_cache_path"]
    )

    logger.debug("Running FastQC on trimming results")
    await run_cache_qc(job)
    await set_cache_stats(job, cache)

    logger.debug("Saving cache data")
    await save_cache(job)

    logger.debug("Using cache for analysis run")
    await use_cache(job)


async def fetch_raw(job):
    paired = job.params["paired"]

    paths = virtool.samples.utils.join_read_paths(
        job.params["sample_path"],
        paired
    )

    raw_paths = list()

    for index, path in enumerate(paths):
        dst = virtool.samples.utils.join_read_path(
            job.params["raw_path"],
            index + 1
        )

        raw_paths.append(dst)

        await job.run_in_executor(
            shutil.copyfile,
            path,
            dst
        )

    return raw_paths


async def run_cache_qc(job):
    cache_id = job.intermediate["cache_id"]

    fastqc_path = os.path.join(
        job.params["temp_cache_path"],
        "fastqc"
    )

    await job.run_in_executor(
        os.makedirs,
        fastqc_path
    )

    read_paths = [os.path.join(job.params["temp_cache_path"], "reads_1.fq.gz")]

    if job.params["paired"]:
        read_paths.append(os.path.join(job.params["temp_cache_path"], "reads_2.fq.gz"))

    await virtool.jobs.fastqc.run_fastqc(
        job.run_subprocess,
        job.proc,
        read_paths,
        fastqc_path
    )

    qc = await job.run_in_executor(
        virtool.jobs.fastqc.parse_fastqc,
        fastqc_path,
        job.params["sample_path"]
    )

    await job.db.caches.update_one({"_id": cache_id}, {
        "$set": {
            "quality": qc
        }
    })


async def set_cache_stats(job, cache):
    paths = virtool.samples.utils.join_read_paths(
        job.params["temp_cache_path"],
        job.params["paired"]
    )

    cache_files = list()

    for path in paths:
        name = pathlib.Path(path).name
        stats = virtool.utils.file_stats(path)

        cache_files.append({
            "name": name,
            "size": stats["size"]
        })

    await job.db.caches.update_one({"_id": cache["id"]}, {
        "$set": {
            "files": cache_files,
            "ready": True
        }
    })


async def save_cache(job):
    await job.run_in_executor(
        shutil.copytree,
        job.params["temp_cache_path"],
        os.path.join(job.settings["data_path"], "caches", job.intermediate["cache_id"])
    )


async def use_cache(job):
    names = ["reads_1.fq.gz"]

    if job.params["paired"]:
        names.append("reads_2.fq.gz")

    coros = list()

    for name in names:
        coros.append(job.run_in_executor(
            shutil.move,
            os.path.join(job.params["temp_cache_path"], name),
            os.path.join(job.params["reads_path"], name)
        ))

    await asyncio.gather(*coros)

    await job.run_in_executor(
        shutil.rmtree,
        job.params["temp_cache_path"]
    )


def rename_trimming_results(path):
    """
    Rename Skewer output to a simple name used in Virtool.

    :param path:

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


async def set_cache_id(job, cache_id):
    job.intermediate["cache_id"] = cache_id

    await job.db.analyses.update_one({"_id": job.params["analysis_id"]}, {
        "$set": {
            "cache": {
                "id": cache_id
            }
        }
    })
