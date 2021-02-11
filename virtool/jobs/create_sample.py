import os
import shutil

import virtool.jobs.fastqc
import virtool.jobs.job
import virtool.jobs.utils
import virtool.samples.db
import virtool.samples.utils
import virtool.utils


async def check_db(job):
    job.params = await virtool.jobs.utils.get_sample_params(
        job.db,
        job.settings,
        job.task_args
    )

    temp_sample_path = os.path.join(
        job.temp_dir.name,
        job.params["sample_id"]
    )

    job.params.update({
        "temp_sample_path": temp_sample_path,
        "fastqc_path": os.path.join(temp_sample_path, "fastqc")
    })


async def make_sample_dir(job):
    """
    Make a data directory for the sample and a subdirectory for analyses. Read files, quality data from FastQC, and
    analysis data will be stored here.

    """
    analysis_path = os.path.join(job.params["temp_sample_path"], "analysis")

    await job.run_in_executor(os.makedirs, analysis_path)
    await job.run_in_executor(os.makedirs, job.params["fastqc_path"])


async def copy_files(job):
    """
    Copy the files from the files directory to the nascent sample directory.

    """
    files = job.params["files"]
    sample_id = job.params["sample_id"]

    paths = [os.path.join(job.settings["data_path"], "files", file["id"]) for file in files]

    sizes = await job.run_in_executor(
        virtool.jobs.utils.copy_files_to_sample,
        paths,
        job.params["temp_sample_path"],
        job.proc
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

    await job.db.samples.update_one({"_id": sample_id}, {
        "$set": {
            "files": raw
        }
    })


async def fastqc(job):
    """
    Runs FastQC on the renamed, trimmed read files.

    """
    read_paths = virtool.samples.utils.join_read_paths(job.params["temp_sample_path"], job.params["paired"])

    await virtool.jobs.fastqc.run_fastqc(
        job.run_subprocess,
        job.proc,
        read_paths,
        job.params["fastqc_path"]
    )


async def parse_fastqc(job):
    """
    Capture the desired data from the FastQC output. The data is added to the samples database
    in the main run() method

    """
    qc = await job.run_in_executor(
        virtool.jobs.fastqc.parse_fastqc,
        job.params["fastqc_path"],
        job.params["temp_sample_path"]
    )

    await job.db.samples.update_one({"_id": job.params["sample_id"]}, {
        "$set": {
            "quality": qc,
            "ready": True
        }
    })


async def upload(job):
    await job.run_in_executor(
        shutil.copytree,
        job.params["temp_sample_path"],
        job.params["sample_path"]
    )


async def clean_watch(job):
    """ Remove the original read files from the files directory """
    file_ids = [f["id"] for f in job.params["files"]]
    await job.db.files.delete_many({"_id": {"$in": file_ids}})


async def delete_sample(job):
    await job.db.samples.delete_one({"_id": job.params["sample_id"]})

    try:
        await job.run_in_executor(shutil.rmtree, job.params["sample_path"])
    except FileNotFoundError:
        pass


async def release_files(job):
    for file_id in job.params["files"]:
        await job.db.files.update_many({"_id": file_id}, {
            "$set": {
                "reserved": False
            }
        })


def create():
    job = virtool.jobs.job.Job()

    job.on_startup = [
        check_db
    ]

    job.steps = [
        make_sample_dir,
        copy_files,
        fastqc,
        parse_fastqc,
        upload,
        clean_watch
    ]

    job.on_cleanup = [
        delete_sample,
        release_files
    ]

    return job
