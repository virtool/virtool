import asyncio
import asyncio.base_futures
import datetime
import json
import math
import re

from aiohttp import web

import virtool.users.utils
import virtool.utils


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


def compose_regex_query(term, fields):
    if not isinstance(fields, (list, tuple)):
        raise TypeError("Type of 'fields' must be one of 'list' or 'tuple'")

    # Stringify fields.
    fields = [str(field) for field in virtool.utils.coerce_list(fields)]

    term = re.escape(term)

    # Compile regex, making is case-insensitive.
    regex = re.compile(str(term), re.IGNORECASE)

    # Compose and return $or-based query.
    return {
        "$or": [{field: {"$regex": regex}} for field in fields]
    }


def json_response(data, status=200, headers=None):
    """
    A wrapper for ``aiohttp.web.json_response`` that uses :func:``.dumps`` to pretty format the JSON response.

    :param data: the data to send in the response as JSON
    :type data: object

    :param status: the HTTP status code for the response
    :type status: int

    :param headers: HTTP response headers
    :type headers: dict

    :return: the response
    :rtype: :class:`aiohttp.web.Response`

    """
    headers = headers or {}

    return web.json_response(data, status=status, headers=headers, dumps=dumps)


def no_content():
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``204`` status and no body.

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return web.Response(status=204)


def bad_gateway(message="Bad gateway"):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``502`` status and the JSON body
    ``{"message": "Bad gateway"}``.

    :param message: text to send instead of 'Bad gateway'
    :type message: str

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({
        "id": "bad_gateway",
        "message": message
    }, status=502)


def bad_request(message="Bad request"):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``400`` status the JSON body
    ``{"message": "Bad request"}``.

    :param message: text to send instead of 'Bad request'
    :type message: str

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({
        "id": "bad_request",
        "message": message
    }, status=400)


def insufficient_rights(message="Insufficient rights"):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``401`` status and the JSON body
    ``{"message": "Bad request"}``.

    :param message: text to send instead of 'Bad request'
    :type message: str

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({
        "id": "insufficient_rights",
        "message": message
    }, status=403)


def not_found(message="Not found"):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``404`` status the JSON body
    ``{"message": "Not found"}``.

    :param message: text to send instead of 'Not found'
    :type message: str

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({
        "id": "not_found",
        "message": message
    }, status=404)


def conflict(message="Conflict"):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``409`` status the JSON body
    ``{"message": "Conflict"}``.

    :param message: text to send instead of 'Not found'
    :type message: str

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({
        "id": "conflict",
        "message": message
    }, status=409)


def invalid_input(errors):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``422`` status the JSON body
    ``{"message": "Invalid input", "errors": <errors>}``.

    :param errors: error output from a :class:`cerberus.Validator` that led to the error response
    :type errors: dict

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({
        "id": "invalid_input",
        "message": "Invalid input",
        "errors": errors
    }, status=422)


def invalid_query(errors):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``422`` status the JSON body
    ``{"message": "Invalid query", "errors": <errors>}``.

    :param errors: error output from a :class:`cerberus.Validator` that led to the error response
    :type errors: dict

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({
        "id": "invalid_query",
        "message": "Invalid query",
        "errors": errors
    }, status=422)


async def paginate(collection, db_query, url_query, sort=None, projection=None, base_query=None,
                   processor=virtool.utils.base_processor, reverse=False):
    try:
        page = int(url_query["page"])
    except (KeyError, ValueError):
        page = 1

    try:
        per_page = int(url_query["per_page"])
    except (KeyError, ValueError):
        per_page = 25

    base_query = base_query or {}

    if isinstance(sort, str):
        sort = [(sort, -1 if reverse else 1)]

    db_query = {
        "$and": [base_query, db_query]
    }

    cursor = collection.find(
        db_query,
        projection,
        sort=sort
    )

    found_count = await asyncio.shield(cursor.count())

    page_count = int(math.ceil(found_count / per_page))

    documents = list()

    if found_count:
        if page > 1:
            cursor.skip((page - 1) * per_page)

        documents = [processor(d) for d in await asyncio.shield(cursor.to_list(per_page))]

    total_count = await collection.count(base_query)

    return {
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": page_count,
        "per_page": per_page,
        "page": page
    }
