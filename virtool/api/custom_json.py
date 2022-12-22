"""
Code for working with JSON.

:class:`CustomEncoder` is a custom JSON encoder that encodes :class:`datetime.datetime`
objects into ISO formatted strings. It is used mostly for encoding JSON API responses.

The :func:`dumps` and :func:`pretty_dumps` functions stringify Python data structures
into JSON. The pretty dumper is used for formatting JSON for viewing in the browser.

"""
import datetime

import arrow
import orjson
from pydantic import BaseModel


def datetime_to_isoformat(obj: datetime.datetime) -> str:
    """
    Convert the passed datetime object to a ISO formatted date and time.

    :param obj: the object to format
    :return: ISO-formatted date and time string

    """
    return obj.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def isoformat_to_datetime(time_str: str) -> datetime.datetime:
    return arrow.get(time_str).naive


def default_serializer(obj):
    """
    Converts Pydantic BaseModel objects into Python dictionaries for serialization.
    """
    if issubclass(type(obj), BaseModel):
        return obj.dict(by_alias=True)

    raise TypeError


def dump_bytes(obj: object) -> bytes:
    """
    Dump the passed JSON-serializable object to ``bytes``.

    :param obj: a JSON-serializable object
    :return: a JSON bytestring

    """
    return orjson.dumps(
        obj,
        default=default_serializer,
        option=orjson.OPT_NAIVE_UTC | orjson.OPT_UTC_Z,
    )


loads = orjson.loads


def dump_string(obj: object) -> str:
    """
    Dump the passed JSON-serializable object to a ``str``.

    :param obj: a JSON-serializable object.
    :return: a JSON string
    """
    return dump_bytes(obj).decode(encoding="UTF-8")


def dump_pretty_bytes(obj: object) -> bytes:
    """
    Dump the passed JSON-serializable object to a ``bytes`` with the following niceties:

    * Sorted keys
    * Indentation
    * Convert datetime objects to UTC isoformat times.

    :param obj: a JSON-serializable object
    :return: a JSON bytestring

    """
    return orjson.dumps(
        obj,
        default=default_serializer,
        option=orjson.OPT_INDENT_2
        | orjson.OPT_SORT_KEYS
        | orjson.OPT_NAIVE_UTC
        | orjson.OPT_UTC_Z,
    )
