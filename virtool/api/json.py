import datetime
import json


class CustomEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")

        return json.JSONEncoder.default(self, obj)


def dumps(obj: object) -> str:
    """
    A wrapper for :func:`json.dumps` is able to encode datetime objects in input. Used as ``dumps`` argument for
    :func:`.json_response`.

    :param obj: a JSON-serializable object
    :return: a JSON string
    """
    return json.dumps(obj, cls=CustomEncoder)


def pretty_dumps(obj: object) -> str:
    """
    A wrapper for :func:`json.dumps` that applies pretty formatting to the output. Sorts keys and adds indentation.
    Used as ``dumps`` argument for :func:`.json_response`.

    :param obj: a JSON-serializable object
    :return: a JSON string
    """
    return json.dumps(
        obj,
        cls=CustomEncoder,
        indent=4,
        sort_keys=True
    )
