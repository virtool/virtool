import datetime
import gzip
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
from random import choice
from string import ascii_letters, ascii_lowercase, digits
from typing import Union

import arrow

RE_STATIC_HASH = re.compile("^main.([a-z0-9]+).css$")


def base_processor(document: Union[dict, None]) -> Union[dict, None]:
    """
    Converts a document `dict` returned from MongoDB into a `dict` that can be passed into a JSON response. Removes the
    '_id' key and reassigns it to `id`.

    :param document: the document to process
    :return: processed document

    """
    if document is None:
        return None

    document = dict(document)
    document["id"] = document.pop("_id")

    return document


async def get_client_path() -> str:
    """
    Return the Virtool client path. The path is different between production and development instances of Virtool.

    :return: str
    """
    for path in [os.path.join(sys.path[0], "client"), os.path.join(sys.path[0], "client", "dist")]:
        if os.path.exists(os.path.join(path, "index.html")):
            return path


def rm(path: str, recursive=False) -> bool:
    """
    A function that removes files or directories in a separate thread. Wraps :func:`os.remove` and func:`shutil.rmtree`.

    :param path: the path to remove.

    :param recursive: the operation should recursively descend into dirs.
    :type recursive: bool

    :return: a `bool` indicating if the operation was successful.

    """
    try:
        os.remove(path)
        return True
    except IsADirectoryError:
        if recursive:
            shutil.rmtree(path)
            return True

        raise


def file_stats(path: str) -> dict:
    """
    Return the size and last modification date for the file at `path`.

    :param path: the file path
    :return: the file size and modification datetime

    """
    stats = os.stat(path)

    # Append file entry to reply list
    return {
        "size": stats.st_size,
        "modify": arrow.get(stats.st_mtime).datetime
    }


def timestamp() -> datetime.datetime:
    """
    Returns a datetime object representing the current UTC time. The last 3 digits of the microsecond frame are set
    to zero.

    :return: a UTC timestamp

    """
    # Get tz-aware datetime object.
    dt = arrow.utcnow().naive

    # Set the last three ms digits to 0.
    dt = dt.replace(microsecond=int(str(dt.microsecond)[0:3] + "000"))

    return dt


def random_alphanumeric(length=6, mixed_case=False, excluded=None):
    """
    Generates a random string composed of letters and numbers.

    :param length: the length of the string.
    :type length: int

    :param mixed_case: included alpha characters will be mixed case instead of lowercase
    :type mixed_case: bool

    :param excluded: strings that may not be returned.
    :type excluded: Union[list, set]

    :return: a random alphanumeric string.
    :rtype: string

    """
    excluded = excluded or list()

    characters = digits + (ascii_letters if mixed_case else ascii_lowercase)

    candidate = "".join([choice(characters) for _ in range(length)])

    if candidate not in excluded:
        return candidate

    return random_alphanumeric(length, excluded)


def average_list(list1, list2):
    if not isinstance(list1, list) or not isinstance(list2, list):
        raise TypeError("Both arguments must be lists")

    if len(list1) != len(list2):
        raise TypeError("Both arguments must be lists of the same length")

    return [(value + list2[i]) / 2 for i, value in enumerate(list1)]


def coerce_list(obj):
    """
    Takes an object of any type and returns a list. If ``obj`` is a list it will be passed back with modification.
    Otherwise, a single-item list containing ``obj`` will be returned.

    :param obj: an object of any type.
    :type obj: any

    :return: a list equal to or containing ``obj``.
    :rtype: list

    """
    return [obj] if not isinstance(obj, list) else obj


def to_bool(obj):
    return str(obj).lower() in ["1", "true"]


def get_static_hash(req):
    try:
        client_path = req.app["client_path"]

        for filename in os.listdir(client_path):
            match = RE_STATIC_HASH.match(filename)

            if match:
                return match.group(1)

    except (KeyError, FileNotFoundError):
        pass

    return ""


async def update_status_process(db, _id, progress, step=None, error=None):
    """
    Update the process field in a status document. These fields are used to track long-running asynchronous processes
    such as software updates or data imports.

    More specific update function can be built around this utility.

    :param db: the application database client
    :type db: :class:`~motor.motor_asyncio.AsyncIOMotorClient`

    :param _id: the database _id for the status document
    :type _id: str

    :param progress: the numeric progress number for the step
    :type progress: Union(int, float)

    :param step: the name of the step in progress
    :type step: Coroutine[str]

    :param error: an error that stopped the process
    :type error: str

    :return: processed status document
    :rtype: Coroutine[dict]

    """
    set_dict = {
        "process.progress": progress
    }

    if step:
        set_dict["process.step"] = step

    if error:
        set_dict["process.error"] = error

    document = await db.status.find_one_and_update({"_id": _id}, {
        "$set": set_dict
    })

    return base_processor(document)


def get_temp_dir():
    return tempfile.TemporaryDirectory()


def compress_file(path: str, target: str, processes=1):
    """
    Compress the file at `path` to a gzipped file at `target`.

    """
    if should_use_pigz(processes):
        compress_file_with_pigz(path, target, processes)
    else:
        compress_file_with_gzip(path, target)


def compress_file_with_gzip(path, target):
    with open(path, "rb") as f_in:
        with gzip.open(target, "wb", compresslevel=6) as f_out:
            shutil.copyfileobj(f_in, f_out)


def compress_file_with_pigz(path, target, processes):
    command = [
        "pigz",
        "-p", str(processes),
        "-k",
        "--stdout",
        path
    ]

    with open(target, "wb") as f:
        subprocess.call(command, stdout=f)


def decompress_file(path: str, target: str, processes=1):
    """
    Decompress the gzip-compressed file at `path` to a `target` file.

    :param path:
    :param target:
    :param processes:

    """
    if processes > 1 and shutil.which("pigz"):
        decompress_file_with_pigz(path, target, processes)
    else:
        decompress_file_with_gzip(path, target)


def decompress_file_with_gzip(path, target):
    with gzip.open(path, "rb") as f_in:
        with open(target, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)


def decompress_file_with_pigz(path: str, target: str, processes: int):
    command = [
        "pigz",
        "-p", str(processes),
        "-d",
        "-k",
        "--stdout",
        path
    ]

    with open(target, "w") as f:
        subprocess.call(command, stdout=f)


def decompress_tgz(path: str, target: str):
    """
    Decompress the tar.gz file at ``path`` to the directory ``target``.

    :param path: the path to the tar.gz file.
    :param target: the path to directory into which to decompress the tar.gz file.

    """
    with tarfile.open(path, "r:gz") as tar:
        tar.extractall(target)


def is_gzipped(path):
    try:
        with gzip.open(path, "rb") as f:
            f.peek(1)

    except OSError as err:
        if "Not a gzipped file" in str(err):
            return False

        raise

    return True


def should_use_pigz(processes: 1):
    return processes > 1 and shutil.which("pigz")
