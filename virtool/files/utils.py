"""
Utilities for working with uploaded files
"""
import os

#: Files with these extensions will be considered valid read files
FILE_EXTENSION_FILTER = (
    ".fq.gz",
    ".fastq.gz",
    ".fq",
    ".fastq"
)


def has_read_extension(filename):
    return any(filename.endswith(ext) for ext in FILE_EXTENSION_FILTER)


def join_file_path(settings: dict, file_id: str) -> str:
    """
    Return a file path based on the Virtool `data_path` setting and a unique file id.

    :param settings: the application settings
    :param file_id: a file id
    :return: the path for the file with id `file_id`

    """
    return os.path.join(settings["data_path"], "files", file_id)
