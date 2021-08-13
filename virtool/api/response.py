from typing import Any, Dict, Optional

from aiohttp import web


def json_response(data: object, status: int = 200, headers: Optional[dict] = None) -> web.Response:
    """
    Return a response object whose attached JSON dict will be formatted by middleware depending on
    the request's `Accept` header.

    :param data: the data to send in the response as JSON
    :param status: the HTTP status code for the response
    :param headers: HTTP response headers
    :return: the response

    """
    headers = headers or {}

    resp = web.Response(status=status, headers=headers)
    resp["json_data"] = data

    return resp


def not_modified() -> web.Response:
    return web.Response(status=304)


def bad_gateway(message: str = "Bad gateway") -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``502`` status and the
    JSON body ``{"message": "Bad gateway"}``.

    :param message: text to send instead of 'Bad gateway'
    :return: the response

    """
    return json_response({
        "id": "bad_gateway",
        "message": message
    }, status=502)


def bad_request(message: str = "Bad request") -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``400`` status the JSON
    body ``{"message": "Bad request"}``.

    :param message: text to send instead of 'Bad request'
    :return: the response

    """
    return json_response({
        "id": "bad_request",
        "message": message
    }, status=400)


def insufficient_rights(message: str = "Insufficient rights") -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``403`` status and the
    JSON body ``{"message": "Insufficient rights"}``.

    :param message: text to send instead of 'Insufficient rights'
    :return: the response

    """
    return json_response({
        "id": "insufficient_rights",
        "message": message
    }, status=403)


def unauthorized(message: str) -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a `401` status and a JSON
    body containing error details including the passed ``message``

    :param message: text to send
    :return: the response

    """
    return json_response({
        "id": "unauthorized",
        "message": message
    }, status=401)


def not_found(message: str = "Not found") -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``404`` status the JSON
    body ``{"message": "Not found"}``.

    :param message: text to send instead of 'Not found'
    :return: the response

    """
    return json_response({
        "id": "not_found",
        "message": message
    }, status=404)


def conflict(message: str = "Conflict") -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``409`` status the JSON
    body ``{"message": "Conflict"}``.

    :param message: text to send instead of 'Not found'
    :return: the response

    """
    return json_response({
        "id": "conflict",
        "message": message
    }, status=409)


def empty_request(message: str = "Empty request") -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``422`` status the JSON
    body ``{"message": "Empty request"}``.

    :param message: text to send instead of 'Empty request'
    :return: the response

    """
    return json_response({
        "id": "empty_request",
        "message": message
    }, status=422)


def invalid_input(errors: Dict[str, Any]) -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``422`` status the JSON
    body ``{"message": "Invalid input", "errors": <errors>}``.

    :param errors: error output from a :class:`cerberus.Validator` that led to the error response
    :return: the response

    """
    return json_response({
        "id": "invalid_input",
        "message": "Invalid input",
        "errors": errors
    }, status=422)


def invalid_query(errors: Dict[str, Any]) -> web.Response:
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``422`` status the JSON
    body ``{"message": "Invalid query", "errors": <errors>}``.

    :param errors: error output from a :class:`cerberus.Validator` that led to the error response
    :return: the response

    """
    return json_response({
        "id": "invalid_query",
        "message": "Invalid query",
        "errors": errors
    }, status=422)
