import asyncio
import datetime
import functools
import gzip
import hashlib
import os
import secrets
import tempfile
from pathlib import Path
from random import choice
from string import ascii_letters, ascii_lowercase, digits
from typing import Any, Iterable, Optional, Tuple, Dict

import arrow

SUB_DIRS = [
    "caches",
    "files",
    "references",
    "subtractions",
    "samples",
    "history",
    "hmm",
    "logs/jobs",
]


def base_processor(document: Optional[Dict]) -> Optional[Dict]:
    """
    Converts a document from MongoDB into one that form a JSON response.

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


def get_safely(dct: Dict, *keys) -> Any:
    """
    Get values from nested dictionaries while returning ``None`` when a ``KeyError`` or
    ``TypeError`` is raised.

    """
    for key in keys:
        try:
            dct = dct[key]
        except (
            KeyError,
            TypeError,
        ):
            return None

    return dct


def chunk_list(lst: list, n: int):
    """Yield successive n-sized chunks from `lst`."""
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def coerce_list(obj: Any) -> list:
    """
    Takes an object of any type and returns a list.

    If ``obj`` is a list it will be passed back with modification. Otherwise, a
    single-item list containing ``obj`` will be returned.

    :param obj: an object of any type
    :return: a list equal to or containing ``obj``

    """
    return [obj] if not isinstance(obj, list) else obj


def compress_json_with_gzip(json_string: str, target: str):
    """
    Compress the JSON string to a gzipped file at `target`.

    """
    # gzip will fail to open the file if it's parent directory doesn't exist.
    target = Path(target)
    target.parent.mkdir(exist_ok=True, parents=True)

    with gzip.open(target, "wb") as f:
        f.write(json_string)


def ensure_data_dir(data_path: Path):
    """
    Ensure the application data structure is correct. Fix it if it is broken.

    :param data_path: the path to create the data folder structure in

    """
    for subdir in SUB_DIRS:
        os.makedirs(data_path / subdir, exist_ok=True)


def generate_key() -> Tuple[str, str]:
    key = secrets.token_hex(32)
    return key, hash_key(key)


def get_temp_dir():
    return tempfile.TemporaryDirectory()


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def random_alphanumeric(
    length: Optional[int] = 6,
    mixed_case: Optional[bool] = False,
    excluded: Optional[Iterable[str]] = None,
) -> str:
    """
    Generates a random string composed of letters and numbers.

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
    """
    Returns a datetime object representing the current UTC time.

    The last 3 digits of the microsecond frame are set to zero.

    :return: a UTC timestamp

    """
    # Get tz-aware datetime object.
    dt = arrow.utcnow().naive

    # Set the last three ms digits to 0.
    dt = dt.replace(microsecond=int(str(dt.microsecond)[0:3] + "000"))

    return dt


def to_bool(obj):
    return str(obj).lower() in ["1", "true"]


async def wait_for_checks(*aws):
    """
    Concurrently wait for awaitables the raise exceptions when checks fail.

    As soon as the first exception is raised, pending checks are cancelled and exception
    is raised.

    :param aws:
    :return:
    """
    results = await asyncio.gather(*aws, return_exceptions=True)

    for result in results:
        if isinstance(result, BaseException):
            raise result
        if result is not None:
            raise TypeError("Check functions may only return a NoneType object.")
