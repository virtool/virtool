"""
Code for working with JSON.

:class:`CustomEncoder` is a custom JSON encoder that encodes :class:`datetime.datetime`
objects into ISO formatted strings. It is used mostly for encoding JSON API responses.

The :func:`dumps` and :func:`pretty_dumps` functions stringify Python data structures
into JSON. The pretty dumper is used for formatting JSON for viewing in the browser.

"""
import datetime
import json


class CustomEncoder(json.JSONEncoder):
    """
    A custom :class:`JSONEncoder` that converts :class:`datetime` objects to
    ISO-formatting date strings.

    """

    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return isoformat(obj)

        return json.JSONEncoder.default(self, obj)


def isoformat(obj: datetime.datetime) -> str:
    """
    Convert the passed datetime object to a ISO formatted date and time.

    :param obj: the object to format
    :return: ISO-formatted date and time string

    """
    return obj.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def dumps(obj: object) -> str:
    """
    A wrapper for :func:`json.dumps` is able to encode datetime objects in input.

    Used as `dumps` argument for :func:`.json_response`.

    :param obj: a JSON-serializable object
    :return: a JSON string

    """
    return json.dumps(obj, cls=CustomEncoder)


def pretty_dumps(obj: object) -> str:
    """
    A wrapper for :func:`json.dumps` that applies pretty formatting to the output.

    Sorts keys and adds indentation. Used as ``dumps`` argument for
    :func:`.json_response`.

    :param obj: a JSON-serializable object
    :return: a JSON string

    """
    return json.dumps(obj, cls=CustomEncoder, indent=4, sort_keys=True)
