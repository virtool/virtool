import datetime
import json


class CustomEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")

        return json.JSONEncoder.default(self, obj)


def dumps(obj):
    """
    A wrapper for :func:`json.dumps` that applies pretty formatting to the output. Used as ``dumps`` argument for
    :func:`.json_response`.

    :param obj: a JSON-serializable object
    :type obj: object

    :return: a JSON string
    :rtype: str

    """
    return json.dumps(obj, indent=4, sort_keys=False, cls=CustomEncoder)
