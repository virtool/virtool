"""
Code for working with JSON.

:class:`CustomEncoder` is a custom JSON encoder that encodes :class:`datetime.datetime`
objects into ISO formatted strings. It is used mostly for encoding JSON API responses.

The :func:`dumps` and :func:`pretty_dumps` functions stringify Python data structures
into JSON. The pretty dumper is used for formatting JSON for viewing in the browser.

"""
import datetime
import orjson

from pydantic import BaseModel


def isoformat(obj: datetime.datetime) -> str:
    """
    Convert the passed datetime object to a ISO formatted date and time.

    :param obj: the object to format
    :return: ISO-formatted date and time string

    """
    return obj.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def default(obj):
    """
    Converts Pydantic BaseModel objects into Python dictionaries for serialization.
    """
    if issubclass(type(obj), BaseModel):
        return obj.dict(by_alias=True)
    raise TypeError


def dumps(obj: object) -> bytes:
    """
    Calls orjson.dumps that encodes datetime objects in input.

    Used as `dumps` argument for :func:`.json_response`.

    :param obj: a JSON-serializable object
    :return: a JSON bytestring

    """
    return orjson.dumps(
        obj,
        default=default,
        option=orjson.OPT_NAIVE_UTC | orjson.OPT_UTC_Z,
    )


def pretty_dumps(obj: object) -> bytes:
    """
    Calls orjson.dumps that applies pretty formatting to the output.

    Sorts keys, adds indentation and converts datetime objects to ISO format.
    Used as ``dumps`` argument for :func:`.json_response`.

    :param obj: a JSON-serializable object
    :return: a JSON bytestring

    """
    return orjson.dumps(
        obj,
        default=default,
        option=orjson.OPT_INDENT_2
        | orjson.OPT_SORT_KEYS
        | orjson.OPT_NAIVE_UTC
        | orjson.OPT_UTC_Z,
    )


def orjson_serializer(obj) -> str:
    """
    Used by SQLAlchemy as they expect strings.
    """
    return dumps(obj).decode()
