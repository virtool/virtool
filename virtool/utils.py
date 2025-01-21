import asyncio
import datetime
import gzip
import hashlib
import secrets
import tempfile
from collections.abc import Iterable
from contextlib import suppress
from pathlib import Path
from random import choice
from string import ascii_letters, ascii_lowercase, digits
from typing import Any

import arrow
import orjson
from aiohttp import ClientSession
from aiohttp.web import Application
from pydantic import BaseModel

from virtool.api.custom_json import dump_bytes

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
    """Convert a document from MongoDB into one that form a JSON response.

    Removes the '_id' key and reassigns it to `id`.

    :param document: the document to process
    :return: processed document
    """
    if document is None:
        return None

    document = dict(document)

    with suppress(KeyError):
        document["id"] = document.pop("_id")

    return document


def chunk_list(lst: list, n: int) -> Iterable[list]:
    """Yield successive n-sized chunks from `lst`.

    :param lst: the list to chunk
    :param n: the size of each chunk
    :return: an iterable of n-sized chunks
    """
    for i in range(0, len(lst), n):
        yield lst[i : i + n]


def coerce_list(obj: Any) -> list:
    """Attept to coerce ``obj`` to ``list`` type.

    If ``obj`` is a list it will be passed back without modification. Otherwise, a
    single-item list containing ``obj`` will be returned.

    :param obj: an object of any type
    :return: a list equal to or containing ``obj``
    """
    return [obj] if not isinstance(obj, list) else obj


def compress_json_with_gzip(json_bytes: bytes, target: Path) -> None:
    """Compress the JSON string to a gzipped file at `target`."""
    # gzip will fail to open the file if it's parent directory doesn't exist.
    target = Path(target)
    target.parent.mkdir(exist_ok=True, parents=True)

    with gzip.open(target, "wb") as f:
        f.write(json_bytes)


def generate_key() -> tuple[str, str]:
    """Generate a random key and its hash.

    :return: a tuple containing the key and its hash
    """
    key = secrets.token_hex(32)
    return key, hash_key(key)


def get_safely(dct: dict, *keys: str) -> Any:
    """Get values from nested dictionaries.

    Returns ``None`` when a ``KeyError`` or ``TypeError`` is raised while traversing the
    nested dictionaries.

    :param dct: the dictionary to traverse
    :param keys: the keys to traverse
    :return: the value at the nested key or ``None``
    """
    for key in keys:
        try:
            dct = dct[key]
        except (KeyError, TypeError):
            return None

    return dct


def get_all_subclasses(cls: type) -> list[type]:
    """Recursively get all subclasses of a class.

    :param cls: the class to get subclasses of
    :return: a list of all subclasses
    """
    all_subclasses = []

    for subclass in cls.__subclasses__():
        all_subclasses.append(subclass)
        all_subclasses.extend(get_all_subclasses(subclass))

    return all_subclasses


def get_model_by_name(name: str) -> type[BaseModel]:
    """Get a Pydantic model class by its name.

    :param name: the name of the model class
    :return: the model class
    """
    for cls in get_all_subclasses(BaseModel):
        if cls.__name__ == name:
            return cls

    msg = f"Could not find model with name {name}"

    raise ValueError(msg)


def get_temp_dir() -> tempfile.TemporaryDirectory:
    """Get a temporary directory.

    :return: a temporary directory
    """
    return tempfile.TemporaryDirectory()


def hash_key(key: str) -> str:
    """Hash a key using SHA-256.

    :param key: the key to hash
    :return: the hashed key
    """
    return hashlib.sha256(key.encode()).hexdigest()


def dump_json(path: Path, data: Any) -> None:
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
    """Generate a random string composed of letters and numbers.

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


async def wait_for_checks(*aws) -> None:
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
            msg = "Check functions may only return a NoneType object."
            raise TypeError(msg)


def get_http_session_from_app(app: Application) -> ClientSession:
    """Get the application shared :class:`aiohttp.ClientSession` object.

    :param app: the application object
    """
    return app["client"]
