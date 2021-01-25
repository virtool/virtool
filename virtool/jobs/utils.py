import os
import shutil

import virtool.caches.db
import virtool.samples.db
import virtool.samples.utils
import virtool.samples.utils
import virtool.utils

TASK_LG = "lg"
TASK_SM = "sm"

TASK_SIZES = {
    "build_index": TASK_SM,
    "create_sample": TASK_SM,
    "create_subtraction": TASK_SM,
    "aodp": TASK_LG,
    "nuvs": TASK_LG,
    "pathoscope_bowtie": TASK_LG,
}


def copy_files_to_sample(paths, sample_path, proc):
    sizes = list()

    for index, path in enumerate(paths):
        suffix = index + 1
        target = virtool.samples.utils.join_read_path(sample_path, suffix)

        virtool.jobs.utils.copy_or_compress(path, target, proc)

        stats = virtool.utils.file_stats(target)

        sizes.append(stats["size"])

    return sizes


def copy_or_compress(path: str, target: str, proc: int):
    """
    Copy the file at `path` to `target`. Compress the file on-the-fly if it is not already compressed.

    This function will make use of `pigz` for compression. Pass a `proc` number to assign workers to the `pigz` process.

    :param path: the path to copy from
    :param target: the path to copy to
    :param proc: the number of worker processes to allow for pigz

    """
    if virtool.utils.is_gzipped(path):
        shutil.copyfile(path, target)
    else:
        virtool.utils.compress_file(path, target, processes=proc)


def copy_or_decompress(path: str, target: str, proc: int):
    if virtool.utils.is_gzipped(path):
        virtool.utils.decompress_file(path, target, proc)
    else:
        shutil.copyfile(path, target)


async def get_sample_params(db, settings: dict, task_args: dict) -> dict:
    """
    Return a `dict` of parameters that can be assigned to `self.params` in the `create_sample` job.

    This function should be called in :method:`~virtool.job.Job.check_db`.

    :param db: the job database client
    :param settings: the application settings
    :param task_args: the job's `task_args`
    :return: a dict of job params

    """
    params = dict(task_args)

    sample_id = params["sample_id"]

    sample_path = os.path.join(
        settings["data_path"],
        "samples",
        sample_id
    )

    document = await db.samples.find_one(sample_id)

    params.update({
        "sample_path": sample_path,
        "document": document,
        "files": document["files"],
        "paired": document["paired"]
    })

    return params
