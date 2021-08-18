from typing import Any, Dict, Optional

from aiohttp import web
from aiohttp.web_exceptions import HTTPForbidden, HTTPNotFound, HTTPUnprocessableEntity


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


class InsufficientRights(HTTPForbidden):
    def __init__(self, message="Insufficient rights"):
        super().__init__(text=message, reason="insufficient_rights")


class NotFound(HTTPNotFound):
    def __init__(self, message="Not found"):
        super().__init__(text=message, reason="not_found")


class EmptyRequest(HTTPUnprocessableEntity):
    def __init__(self, message="Empty request"):
        super().__init__(text=message, reason="empty_request")


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
