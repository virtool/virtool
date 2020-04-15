from aiohttp import web

from virtool.api.json import dumps


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
