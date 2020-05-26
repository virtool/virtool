import logging
import os
import shutil

import virtool.jobs.job
import virtool.jobs.utils
import virtool.subtractions.db
import virtool.subtractions.utils
import virtool.utils

logger = logging.getLogger(__name__)


async def check_db(job):
    job.params = dict(job.task_args)

    subtraction_path = os.path.join(
        job.settings["data_path"],
        "subtractions",
        job.params["subtraction_id"]
    )

    temp_subtraction_path = os.path.join(
        job.temp_dir.name,
        job.params["subtraction_id"]
    )

    job.params.update({
        "subtraction_path": subtraction_path,
        "temp_subtraction_path": temp_subtraction_path,

        # The path to the uploaded FASTA file to be used for creating a subtraction.
        "file_path": os.path.join(
            job.settings["data_path"],
            "files",
            job.params["file_id"]
        ),

        "temp_fasta_path": os.path.join(
            temp_subtraction_path,
            "subtraction.fa"
        ),

        "temp_index_path": os.path.join(
            temp_subtraction_path,
            "reference"
        )
    })


async def make_subtraction_dir(job):
    """
    Make a directory for the host index files at ``<vt_data_path>/reference/hosts/<host_id>``.

    """
    await job.run_in_executor(
        os.mkdir,
        job.params["temp_subtraction_path"]
    )


async def unpack(job):
    """
    Unpack the FASTA file if it is gzipped.

    """
    await job.run_in_executor(
        virtool.jobs.utils.copy_or_decompress,
        job.params["file_path"],
        job.params["temp_fasta_path"],
        job.proc
    )


async def set_stats(job):
    """
    Generate some stats for the FASTA file associated with this job. These numbers include nucleotide distribution,
    length distribution, and sequence count.

    """
    gc, count = await virtool.subtractions.utils.calculate_fasta_gc(job.params["temp_fasta_path"])

    await job.db.subtraction.update_one({"_id": job.params["subtraction_id"]}, {
        "$set": {
            "gc": gc,
            "count": count
        }
    })


async def bowtie_build(job):
    """
    Call *bowtie2-build* using :meth:`~.Job.run_process` to build a Bowtie2 index for the host.

    """
    command = [
        "bowtie2-build",
        "-f",
        "--threads", str(job.proc),
        job.params["temp_fasta_path"],
        job.params["temp_index_path"]
    ]

    await job.run_subprocess(command)

    await job.db.subtraction.update_one({"_id": job.params["subtraction_id"]}, {
        "$set": {
            "ready": True
        }
    })


async def compress(job):
    """
    Compress the subtraction FASTA file for long-term storage and download.

    """
    await job.run_in_executor(
        virtool.utils.compress_file,
        job.params["temp_fasta_path"],
        job.params["temp_fasta_path"] + ".gz",
        job.proc
    )

    await job.run_in_executor(
        virtool.utils.rm,
        job.params["temp_fasta_path"]
    )

    await job.run_in_executor(
        shutil.copytree,
        job.params["temp_subtraction_path"],
        job.params["subtraction_path"]
    )


async def delete_subtraction(job):
    """
    Clean up if the job process encounters an error or is cancelled. Removes the host document from the database
    and deletes any index files.

    """
    try:
        await job.run_in_executor(
            virtool.utils.rm,
            job.params["subtraction_path"],
            True
        )
    except FileNotFoundError:
        pass

    await job.db.subtraction.delete_one({"_id": job.params["subtraction_id"]})


def create():
    job = virtool.jobs.job.Job()

    job.on_startup = [
        check_db
    ]

    job.steps = [
        make_subtraction_dir,
        unpack,
        set_stats,
        bowtie_build,
        compress
    ]

    job.on_cleanup = [
        delete_subtraction
    ]

    return job
