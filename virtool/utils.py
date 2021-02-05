import datetime
import gzip
import hashlib
import os
import re
import secrets
import shutil
import subprocess
import sys
import tarfile
import tempfile
from random import choice
from string import ascii_letters, ascii_lowercase, digits
from typing import Iterable, Tuple, Union

import aiofiles
import arrow

RE_STATIC_HASH = re.compile("^main.([a-z0-9]+).css$")

SUB_DIRS = [
    "caches",
    "files",
    "references",
    "subtractions",
    "samples",
    "history",
    "hmm",
    "logs/jobs"
]


def average_list(list1, list2):
    if not isinstance(list1, list) or not isinstance(list2, list):
        raise TypeError("Both arguments must be lists")

    if len(list1) != len(list2):
        raise TypeError("Both arguments must be lists of the same length")

    return [(value + list2[i]) / 2 for i, value in enumerate(list1)]


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

    try:
        document["id"] = document.pop("_id")
    except KeyError:
        pass

    return document


def chunk_list(lst, n):
    """Yield successive n-sized chunks from `lst`."""
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def compress_file(path: str, target: str, processes: int = 1):
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


def compress_json_with_gzip(json_string: str, target: str):
    """
    Compress the JSON string to a gzipped file at `target`.

    """
    with gzip.open(target, 'wb') as f:
        f.write(bytes(json_string, "utf-8"))


def coerce_list(obj) -> list:
    """
    Takes an object of any type and returns a list. If ``obj`` is a list it will be passed back with modification.
    Otherwise, a single-item list containing ``obj`` will be returned.

    :param obj: an object of any type
    :return: a list equal to or containing ``obj``

    """
    return [obj] if not isinstance(obj, list) else obj


def decompress_file(path: str, target: str, processes=1):
    """
    Decompress the gzip-compressed file at `path` to a `target` file.

    :param path:
    :param target:
    :param processes:

    """
    if should_use_pigz(processes):
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


def ensure_data_dir(data_path):
    """
    Ensure the application data structure is correct. Fix it if it is broken.

    :param data_path: the path to create the data folder structure in

    """
    for subdir in SUB_DIRS:
        os.makedirs(os.path.join(data_path, subdir), exist_ok=True)


async def file_length(path):
    length = 0

    async with aiofiles.open(path) as f:
        async for _ in f:
            length += 1

    return length


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


def generate_key() -> Tuple[str, str]:
    key = secrets.token_hex(32)
    return key, hash_key(key)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


async def get_client_path() -> str:
    """
    Return the Virtool client path. The path is different between production and development instances of Virtool.

    :return: str
    """
    for path in [os.path.join(sys.path[0], "client"), os.path.join(sys.path[0], "client", "dist")]:
        if os.path.exists(os.path.join(path, "index.html")):
            return path


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


def get_temp_dir():
    return tempfile.TemporaryDirectory()


def is_gzipped(path):
    try:
        with gzip.open(path, "rb") as f:
            f.peek(1)

    except OSError as err:
        if "Not a gzipped file" in str(err):
            return False

        raise

    return True


def random_alphanumeric(length: int = 6, mixed_case: bool = False, excluded: Union[None, Iterable[str]] = None) -> str:
    """
    Generates a random string composed of letters and numbers.

    :param length: the length of the string.
    :param mixed_case: included alpha characters will be mixed case instead of lowercase
    :param excluded: strings that may not be returned.
    :return: a random alphanumeric string.

    """
    excluded = set(excluded or list())

    characters = digits + (ascii_letters if mixed_case else ascii_lowercase)

    candidate = "".join([choice(characters) for _ in range(length)])

    if candidate not in excluded:
        return candidate

    return random_alphanumeric(length=length, excluded=excluded)


def rm(path: str, recursive=False) -> bool:
    """
    A function that removes files or directories in a separate thread. Wraps :func:`os.remove` and func:`shutil.rmtree`.

    :param path: the path to remove
    :param recursive: the operation should recursively descend into dirs
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


def should_use_pigz(processes: int) -> bool:
    """
    Decides whether pigz should be used for gzip decompression. If multiple processes are used and pigz is installed,
    the function evaluates true.

    :param processes: the number of processes to use for decompression
    :return: a boolean indicating if pigz should be used

    """
    return bool(processes > 1 and shutil.which("pigz"))


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


def to_bool(obj):
    return str(obj).lower() in ["1", "true"]
