import os

import virtool.caches.db
import virtool.caches.utils
import virtool.files.db
import virtool.jobs.fastqc
import virtool.jobs.job
import virtool.jobs.utils
import virtool.samples.db
import virtool.samples.utils
import virtool.utils


async def check_db(job):
    job.params = virtool.jobs.utils.get_sample_params(
        job.db,
        job.settings,
        job.task_args
    )


async def copy_files(job):
    """
    Copy the replacement files from the files directory to the sample directory.

    The files are named replacement_reads_<suffix>.fq.gz. They will be compressed if necessary.

    """
    files = job.params["files"]
    sample_id = job.params["sample_id"]

    paths = [os.path.join(job.settings["data_path"], "files", file["replacement"]["id"]) for file in files]

    sizes = virtool.jobs.utils.copy_files_to_sample(
        paths,
        job.params["sample_path"],
        job.proc
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

    job.intermediate["raw"] = raw


async def fastqc(job):
    """
    Runs FastQC on the replacement read files.

    """
    fastq_path = job.params["fastqc_path"]

    try:
        virtool.utils.rm(fastq_path, recursive=True)
    except FileNotFoundError:
        pass

    os.mkdir(fastq_path)

    paths = virtool.samples.utils.join_read_paths(
        job.params["sample_path"],
        job.params["paired"]
    )

    await virtool.jobs.fastqc.run_fastqc(
        job.run_subprocess,
        job.proc,
        paths,
        fastq_path
    )


async def parse_fastqc(job):
    """
    Capture the desired data from the FastQC output. The data is added to the samples database
    in the main run() method

    """
    job.intermediate["qc"] = virtool.jobs.fastqc.parse_fastqc(
        job.params["fastqc_path"],
        job.params["sample_path"],
        prefix="replacement_fastqc_"
    )


async def create_cache(job):
    """
    Create a cache from the old sample files.

    These files constitute a valid cache because they were trimmed in the original CreateSample job.

    """
    sample_id = job.params["sample_id"]

    job.intermediate["cache"] = await virtool.caches.db.create(
        job.db,
        sample_id,
        virtool.samples.utils.LEGACY_TRIM_PARAMETERS,
        job.params["paired"],
        legacy=True
    )

    cache_id = job.intermediate["cache"]["id"]

    files = list()

    cache_path = virtool.caches.utils.join_cache_path(job.settings, cache_id)

    os.makedirs(cache_path)

    for index, file in enumerate(job.params["files"]):
        path = os.path.join(job.params["sample_path"], file["name"])

        name = f"reads_{index + 1}.fq.gz"

        target = os.path.join(cache_path, name)

        virtool.jobs.utils.copy_or_compress(path, target, job.proc)

        stats = virtool.utils.file_stats(target)

        files.append({
            "name": name,
            "size": stats["size"]
        })

    await job.db.caches.update_one({"_id": cache_id}, {
        "$set": {
            "ready": True,
            "files": files,
            "quality": job.params["document"]["quality"]
        }
    })

    analysis_query = {"sample.id": sample_id}

    await job.db.analyses.update_many(analysis_query, {
        "$set": {
            "cache": {
                "id": cache_id
            }
        }
    })


async def replace_old(job):
    sample_id = job.params["sample_id"]

    files = list()

    # Prepare new list for `files` field in sample document.
    for index, file in enumerate(job.params["files"]):
        name = f"reads_{index + 1}.fq.gz"

        path = os.path.join(job.params["sample_path"], name)

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
    await job.db.samples.update_one({"_id": job.params["sample_id"]}, {
        "$set": {
            "files": files,
            "prune": True,
            "quality": job.intermediate["qc"]
        },
        "$unset": {
            "update_job": ""
        }
    })


async def delete_cache(job):
    # Remove cache
    cache = job.intermediate.get("cache")

    if cache:
        cache_id = cache["id"]
        await job.db.delete_one({"_id": cache_id})
        cache_path = virtool.caches.utils.join_cache_path(job.settings, cache_id)

        # Remove cache directory.
        try:
            virtool.utils.rm(cache_path, recursive=True)
        except FileNotFoundError:
            pass


async def reset_analyses(job):
    """
    Undo analysis cache field addition.

    :param job:

    """
    analysis_query = {"sample.id": job.params["sample_id"]}

    job.db.analyses.update_many(analysis_query, {
        "$unset": {
            "cache": ""
        }
    })


async def reset_samples(job):
    """
    Undo sample document changes.

    :param job:

    """
    job.db.samples.update_one({"_id": job.params["sample_id"]}, {
        "$set": {
            # Use old files and quality fields.
            "files": job.params["files"],
            "quality": job.params["document"]["quality"]
        },
        "$unset": {
            "prune": "",
            "update_job": ""
        }
    })

    # Remove sample files.
    paths = virtool.samples.utils.join_read_paths(job.params["sample_path"], paired=True)

    for path in paths:
        try:
            virtool.utils.rm(path)
        except FileNotFoundError:
            pass


update_sample_job = virtool.jobs.job.Job()

update_sample_job.on_startup = [
    check_db
]

update_sample_job.steps = [
    copy_files,
    fastqc,
    parse_fastqc,
    create_cache,
    replace_old
]

update_sample_job.on_cleanup = [
    delete_cache,
    reset_analyses,
    reset_samples
]
