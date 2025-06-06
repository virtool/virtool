import asyncio
import datetime
import gzip
import hashlib
import os
import secrets
import shutil
import subprocess
import tarfile
import tempfile
from collections.abc import Iterable
from pathlib import Path
from random import choice
from string import ascii_letters, ascii_lowercase, digits
from tarfile import TarFile
from typing import Any

import arrow
import orjson
from aiohttp import ClientSession
from aiohttp.web import Application

from virtool.api.custom_json import dump_bytes
from virtool.models.base import BaseModel

SUB_DIRS = [
    "files",
    "references",
    "subtractions",
    "samples",
    "history",
    "hmm",
    "logs/jobs",
]


def base_processor(document: dict | None) -> dict | None:
    """Converts a document from MongoDB into one that form a JSON response.

    Removes the '_id' key and reassigns it to `id`.

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


def chunk_list(lst: list, n: int):
    """Yield successive n-sized chunks from `lst`."""
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def coerce_list(obj: Any) -> list:
    """Takes an object of any type and returns a list.

    If ``obj`` is a list it will be passed back with modification. Otherwise, a
    single-item list containing ``obj`` will be returned.

    :param obj: an object of any type
    :return: a list equal to or containing ``obj``

    """
    return [obj] if not isinstance(obj, list) else obj


def compress_json_with_gzip(json_bytes: bytes, target: Path):
    """Compress the JSON string to a gzipped file at `target`."""
    # gzip will fail to open the file if it's parent directory doesn't exist.
    target = Path(target)
    target.parent.mkdir(exist_ok=True, parents=True)

    with gzip.open(target, "wb") as f:
        f.write(json_bytes)


def ensure_data_dir(data_path: Path):
    """Ensure the application data structure is correct. Fix it if it is broken.

    :param data_path: the path to create the data folder structure in

    """
    for subdir in SUB_DIRS:
        os.makedirs(data_path / subdir, exist_ok=True)


def generate_key() -> tuple[str, str]:
    key = secrets.token_hex(32)
    return key, hash_key(key)


def get_safely(dct: dict, *keys) -> Any:
    """Get values from nested dictionaries while returning ``None`` when a ``KeyError``
    or ``TypeError`` is raised.
    """
    for key in keys:
        try:
            dct = dct[key]
        except (KeyError, TypeError):
            return None

    return dct


def get_all_subclasses(cls):
    all_subclasses = []

    for subclass in cls.__subclasses__():
        all_subclasses.append(subclass)
        all_subclasses.extend(get_all_subclasses(subclass))

    return all_subclasses


def get_model_by_name(name: str) -> type[BaseModel]:
    for cls in get_all_subclasses(BaseModel):
        if cls.__name__ == name:
            return cls

    raise ValueError(f"Could not find model with name {name}")


def get_temp_dir():
    return tempfile.TemporaryDirectory()


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def dump_json(path: Path, data: Any) -> Any:
    """Dump JSON serializable ``data`` to a file at `path`.

    :param path: the path to the JSON file
    :param data: the data to dump
    """
    with open(path, "wb") as f:
        f.write(dump_bytes(data))


def load_json(path: Path) -> Any:
    """Load the JSON file at `path` and return it as a Python object.

    :param path: the path to the JSON file
    :return: the loaded JSON object
    """
    with open(path, "rb") as f:
        return orjson.loads(f.read())


def random_alphanumeric(
    length: int | None = 6,
    mixed_case: bool | None = False,
    excluded: Iterable[str] | None = None,
) -> str:
    """Generates a random string composed of letters and numbers.

    :param length: the length of the string.
    :param mixed_case: included alpha characters will be mixed case instead of lowercase
    :param excluded: strings that may not be returned.
    :return: a random alphanumeric string.

    """
    excluded = set(excluded or [])

    characters = digits + (ascii_letters if mixed_case else ascii_lowercase)

    candidate = "".join([choice(characters) for _ in range(length)])

    if candidate not in excluded:
        return candidate

    return random_alphanumeric(length=length, excluded=excluded)


def timestamp() -> datetime.datetime:
    """Return a naive datetime object representing the current UTC time.

    :return: a UTC timestamp
    """
    return arrow.utcnow().naive


def to_bool(obj):
    return str(obj).lower() in ["1", "true"]


async def wait_for_checks(*aws):
    """Concurrently wait for awaitables the raise exceptions when checks fail.

    As soon as the first exception is raised, pending checks are cancelled and exception
    is raised.

    :param aws: a list of awaitables to wait for
    """
    results = await asyncio.gather(*aws, return_exceptions=True)

    for result in results:
        if isinstance(result, BaseException):
            raise result
        if result is not None:
            raise TypeError("Check functions may only return a NoneType object.")


def get_http_session_from_app(app: Application) -> ClientSession:
    """Get the application shared :class:`aiohttp.ClientSession` object.

    :param app: the application object
    """
    return app["client"]


def should_use_pigz(processes: int) -> bool:
    """Decides whether pigz should be used for gzip decompression.

    :param processes: the number of processes to use for decompression
    :return: True if pigz is available and multiple processes
             should be used, and False otherwise

    """
    return bool(processes > 1 and shutil.which("pigz"))


def is_gzipped(path: Path) -> bool:
    """:param path: path of the file to check
    :return: True if the file is gzipped, else False
    """
    try:
        with gzip.open(path, "rb") as f:
            f.peek(1)
    except OSError as err:
        if "Not a gzipped file" in str(err):
            return False

    return True


def rm(path: Path, recursive: bool = False) -> bool:
    """Remove files. Wraps :func:`os.remove` and func:`shutil.rmtree`.
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


def file_length(path: Path) -> int:
    """Determine the number of lines in a file.

    :param path: path to file of which to compute the length
    :return: the number of lines in the file
    """
    length = 0

    with path.open() as f:
        for _ in f:
            length += 1

    return length


def file_stats(path: Path) -> dict:
    """Return the size and last modification date for the file at `path`.
    Wraps :func:`os.stat`
    :param path: the file path
    :return: the file size and modification datetime
    """
    stats = os.stat(path)

    return {"size": stats.st_size, "modify": arrow.get(stats.st_mtime).datetime}


def decompress_tgz(path: Path, target: Path):
    """Decompress the tar.gz file at ``path`` to the directory ``target``.

    :param path: the path to the tar.gz file.
    :param target: the path to directory into which to decompress the tar.gz file.

    """
    with tarfile.open(path, "r:gz") as tar:
        safely_extract_tgz(tar, target)


def is_within_directory(directory: Path, target: Path) -> bool:
    """Check whether a file is within a directory.

    :param directory: the path to the directory
    :param target: the path to the file

    """
    abs_directory = os.path.abspath(directory)
    abs_target = os.path.abspath(target)

    prefix = os.path.commonprefix([abs_directory, abs_target])

    return prefix == abs_directory


def safely_extract_tgz(tar: TarFile, path: Path):
    """Safely extract a tar.gz file, ensuring that all member files are within the tarball.

    This prevents directory traversal attacks described in CVE-2007-4559.

    :param tar: the tarfile
    :param path: the path to extract to
    """
    for member in tar.getmembers():
        if not is_within_directory(path, path / member.name):
            raise Exception("Attempted Path Traversal in Tar File")

    tar.extractall(path)


def decompress_file_with_pigz(path: Path, target: Path, processes: int):
    """Decompress a file using pigz

    :param path: path to the compressed file to be decompressed
    :param target: path for the newly decompressed file to be stored
    :param processes: the number of allowable processes for pigz (-p argument)
    """
    command = [
        "pigz",
        "-p",
        str(processes),
        "-d",
        "-k",
        "--stdout",
        str(path.resolve()),
    ]

    with open(target, "w") as f:
        subprocess.call(command, stdout=f)


def decompress_file(path: Path, target: Path, processes: int = 1) -> None:
    """Decompress the gzip-compressed file at `path` to a `target` file.

    pigz will be used when multiple processes are allowed, otherwise gzip is used

    :param path: path to the compressed file to be decompressed
    :param target: path for the newly decompressed file to be stored
    :param processes: number of allowable processes for decompression

    """
    if should_use_pigz(processes):
        decompress_file_with_pigz(path, target, processes)
    else:
        decompress_file_with_gzip(path, target)


def decompress_file_with_gzip(path: Path, target: Path):
    """Decompress a file using gzip

    :param path: path to the compressed file to be decompressed
    :param target: path for the newly decompressed file to be stored
    """
    with gzip.open(path, "rb") as f_in:
        with open(target, "wb") as f_out:
            shutil.copyfileobj(f_in, f_out)


def compress_file_with_pigz(path: Path, target: Path, processes: int):
    """Use pigz to compress a file
    :param path: path to the file to be compressed
    :param target: path where the compressed file should be stored
    :param processes: number of processes allowable for pigz (-p argument)
    """
    command = ["pigz", "-p", str(processes), "-k", "--stdout", str(path.resolve())]

    with open(target, "wb") as f:
        subprocess.call(command, stdout=f)


def compress_file_with_gzip(path: Path, target: Path) -> None:
    """Compresses a file using gzip
    :param path: path to the file to be compressed
    :param target: path where the compressed file should be stored
    """
    with open(path, "rb") as f_in:
        with gzip.open(target, "wb", compresslevel=6) as f_out:
            shutil.copyfileobj(f_in, f_out)


def compress_file(path: Path, target: Path, processes: int = 1) -> None:
    """Compress the file at `path` to a gzipped file at `target`.

    :param path: the path of the file to be compressed
    :param target: path where the compressed file should be saved
    :param processes: the number of processes available for compression
    """
    if should_use_pigz(processes):
        compress_file_with_pigz(path, target, processes)
    else:
        compress_file_with_gzip(path, target)
