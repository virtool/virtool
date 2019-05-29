import os
import shutil
from typing import Union

import virtool.db.caches
import virtool.db.samples
import virtool.samples
import virtool.utils


def copy_files_to_sample(paths, sample_path, proc):
    sizes = list()

    for index, path in enumerate(paths):
        suffix = index + 1
        target = join_read_path(sample_path, suffix)

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


def get_sample_params(db, settings: dict, task_args: dict) -> dict:
    """
    Return a `dict` of parameters that can be assigned to `self.params` in the `create_sample` and `update_sample` jobs.

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

    document = db.samples.find_one(sample_id)

    params.update({
        "sample_path": sample_path,
        "analysis_path": os.path.join(sample_path, "analysis"),
        "fastqc_path": os.path.join(sample_path, "fastqc"),
        "document": document,
        "files": document["files"],
        "paired": document["paired"]
    })

    return params


def find_cache(db, sample_id: str, program: str, parameters: dict) -> Union[dict, None]:
    """
    Find a cache matching the passed `sample_id`, `program` name and version, and set of trimming `parameters`.

    If no matching cache exists, `None` will be returned.

    :param db: the application database interface
    :param sample_id: the id of the parent sample
    :param program: the program and version used to create the cache
    :param parameters: the parameters used for the trim
    :return: a cache document

    """
    document = db.caches.find_one({
        "sample.id": sample_id,
        "program": program,
        "hash": virtool.db.caches.calculate_cache_hash(parameters)
    })

    if document:
        return virtool.utils.base_processor(document)


def join_read_path(base_path: str, suffix: int) -> str:
    """
    Return a standard read path given a base path (eg. /mnt/data/samples) and a read suffix.

    :param base_path: a base path where the read file is located
    :param suffix: the suffix number for the read file
    :return: a read path

    """
    return os.path.join(base_path, f"reads_{suffix}.fq.gz")


def join_read_paths(base_path: str, paired: bool) -> list:
    """
    Return a list of standard read paths given a base path and flag indicating whether the reads are `paired`.

    The list will contain two paths if the data is paired, and one if it is not.

    :param base_path: a base path where the read files are located
    :param paired: a boolean flag indicating whether the data is paired
    :return: a list of read paths

    """
    if paired:
        return [join_read_path(base_path, suffix) for suffix in (1, 2)]

    return [join_read_path(base_path, 1)]


def join_cache_path(settings: dict, cache_id: str):
    """
    Create a cache path string given the application settings and cache id.

    :param settings: the application settings
    :param cache_id: the id of the cache
    :return: a cache path

    """
    return os.path.join(settings["data_path"], "caches", cache_id)


def join_cache_read_paths(settings: dict, cache: dict) -> Union[list, None]:
    """
    Return a list of read paths for a cache given the application settings and the cache document.

    The path list will contain two paths if paired, and one if not.

    :param settings: the application settings
    :param cache: a cache document
    :return: a list of read paths

    """
    if not cache:
        return None

    cache_path = join_cache_path(settings, cache["id"])

    return join_read_paths(cache_path, cache["paired"])
