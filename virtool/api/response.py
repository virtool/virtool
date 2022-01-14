from typing import Optional

from aiohttp.web import Response
from aiohttp.web_exceptions import HTTPForbidden, HTTPNotFound, HTTPUnprocessableEntity


def json_response(
    data: object, status: int = 200, headers: Optional[dict] = None
) -> Response:
    """
    Return a response object whose attached JSON dict will be formatted by middleware
    depending on the request's `Accept` header.

    :param data: the data to send in the response as JSON
    :param status: the HTTP status code for the response
    :param headers: HTTP response headers
    :return: the response

    """
    headers = headers or {}

    resp = Response(status=status, headers=headers)
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


class InvalidQuery(HTTPUnprocessableEntity):
    def __init__(self, errors, message="Invalid query"):
        super().__init__(text=message, reason="invalid_query")
        self.errors = errors


class InvalidInput(HTTPUnprocessableEntity):
    def __init__(self, errors, message="Invalid input"):
        super().__init__(text=message, reason="invalid_input")
        self.errors = errors
