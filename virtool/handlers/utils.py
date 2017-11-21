import re
import math
import json
import datetime
from aiohttp import web
from cerberus import Validator

import virtool.utils
import virtool.user_permissions


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


async def unpack_request(req):
    """
    A shortcut for pulling the app database reference and the request JSON body from a :class:`~aiohttp.web.Request`
    object.

    :param req: a request
    :type req: :class:`~aiohttp.web.Request`

    :return: the app DB connection and the request JSON body
    :rtype: Coroutine[tuple]

    """
    return req.app["db"], await req.json()


def compose_regex_query(term, fields):
    if not isinstance(fields, (list, tuple)):
        raise TypeError("Type of 'fields' must be one of 'list' or 'tuple'")

    # Stringify fields.
    fields = [str(field) for field in virtool.utils.coerce_list(fields)]

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


def protected(required_perm=None):
    if required_perm and required_perm not in virtool.user_permissions.PERMISSIONS:
        raise ValueError("Permission {} is not valid".format(required_perm))

    def decorator(handler):
        async def wrapped(req):
            if not req["client"].user_id:
                return json_response({
                    "id": "requires_authorization",
                    "message": "Requires authorization"
                }, status=401)

            if required_perm and not req["client"].permissions[required_perm]:
                return json_response({
                    "id": "not_permitted",
                    "message": "Not permitted"
                }, status=403)

            return await handler(req)

        return wrapped

    return decorator


def validation(schema):
    def decorator(handler):
        async def wrapped(req):
            v = Validator(schema)

            data = await req.json()

            if not v(data):
                return invalid_input(v.errors)

            req["data"] = v.document

            return await handler(req)

        return wrapped

    return decorator


async def paginate(collection, db_query, url_query, sort_by=None, projection=None, base_query=None,
                   processor=virtool.utils.base_processor, reverse=False):

    page = int(url_query.get("page", 1))
    per_page = int(url_query.get("per_page", 15))

    base_query = base_query or {}

    total_count = await collection.count(base_query)

    sort = None

    if sort_by:
        sort = [(sort_by, -1 if reverse else 1)]

    db_query.update(base_query)

    cursor = collection.find(
        db_query,
        projection,
        sort=sort
    )

    found_count = await cursor.count()

    page_count = int(math.ceil(found_count / per_page))

    if page > 1:
        cursor.skip((page - 1) * per_page)

    documents = [processor(d) for d in await cursor.to_list(per_page)]

    return {
        "documents": documents,
        "total_count": total_count,
        "found_count": found_count,
        "page_count": page_count,
        "per_page": per_page,
        "page": page
    }
