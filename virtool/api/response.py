"""
Virtool API Response

Exports HTTP Errors and request handling middleware for
reformatting and reporting errors to the client.
"""

from typing import Optional, Dict, Any

from aiohttp.web import Response
from aiohttp.web_exceptions import HTTPForbidden, HTTPNotFound, HTTPUnprocessableEntity

from typing import Callable

from aiohttp import web


def json_response(
    data: Any, status: int = 200, headers: Optional[Dict[str, str]] = None
) -> Response:
    """
    Return a response object whose attached JSON dict will be formatted
    by middleware depending on the request's `Accept` header.

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
    """
    Reusable exception for returning an HTTP status `403`
    (Insufficient Rights) message to the client.
    """

    def __init__(self, message="Insufficient rights"):
        super().__init__(text=message, reason="insufficient_rights")


class NotFound(HTTPNotFound):
    """
    Reusable exception for returning an HTTP status `404`
    (Not Found) message to the client.
    """

    def __init__(self, message="Not found"):
        super().__init__(text=message, reason="not_found")


class EmptyRequest(HTTPUnprocessableEntity):
    """
    Reusable exception for returning an HTTP status `422`
    (Empty Request) message to the client.
    """

    def __init__(self, message="Empty request"):
        super().__init__(text=message, reason="empty_request")


class InvalidQuery(HTTPUnprocessableEntity):
    """
    Reusable exception for returning an HTTP status `422`
    (Invalid Query) message to the client.
    """

    def __init__(self, errors, message="Invalid query"):
        super().__init__(text=message, reason="invalid_query")
        self.errors = errors


class InvalidInput(HTTPUnprocessableEntity):
    """
    Reusable exception for returning an HTTP status `422`
    (Invalid Input) message to the client.
    """

    def __init__(self, errors, message="Invalid input"):
        super().__init__(text=message, reason="invalid_input")
        self.errors = errors


@web.middleware
async def middleware(req: web.Request, handler: Callable):
    """
    Request handling middleware for converting HTTP
    exceptions into HTTP responses.

    :param req: the incoming request
    :param handler: the next middleware to be executed
    """
    try:
        resp = await handler(req)
        return resp
    except web.HTTPException as exc:
        data = {"id": "_".join(exc.reason.lower().split(" ")), "message": exc.text}

        if isinstance(exc, (InvalidQuery, InvalidInput)):
            data["errors"] = exc.errors

        return json_response(data, exc.status)
