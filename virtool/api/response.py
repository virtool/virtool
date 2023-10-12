"""
HTTP error exceptions and middleware for reformatting and reporting
errors to the client.
"""
from typing import Any, Callable, Dict, Optional

from aiohttp import web
from aiohttp.web import Response
from aiohttp.web_exceptions import HTTPForbidden, HTTPNotFound, HTTPUnprocessableEntity


def json_response(
    data: Any, status: int = 200, headers: Optional[Dict[str, str]] = None
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
    """
    Raising this exception during request handling immediately returns a `403` (Insufficient Rights) response to the client.
    """

    def __init__(self, message="Insufficient rights"):
        super().__init__(text=message, reason="insufficient_rights")


class NotFound(HTTPNotFound):
    """
    Raising this exception during request handling immediately returns a `404` (Not Found) response to the client.
    """

    def __init__(self, message="Not found"):
        super().__init__(text=message, reason="not_found")


class EmptyRequest(HTTPUnprocessableEntity):
    """
    Raising this exception during request handling immediately returns a `422` (Empty Request) response to the client.
    """

    def __init__(self, message="Empty request"):
        super().__init__(text=message, reason="empty_request")


class InvalidQuery(HTTPUnprocessableEntity):
    """
    Raising this exception during request handling immediately returns a `422` (Invalid Query) response to the client.
    """

    def __init__(self, errors, message="Invalid query"):
        super().__init__(text=message, reason="invalid_query")
        self.errors = errors


class InvalidInput(HTTPUnprocessableEntity):
    """
    Raising this exception during request handling immediately returns a `422` (Invalid Input) response to the client.
    """

    def __init__(self, errors, message="Invalid input"):
        super().__init__(text=message, reason="invalid_input")
        self.errors = errors


@web.middleware
async def error_middleware(req: web.Request, handler: Callable):
    """
    Middleware for converting HTTP exceptions into HTTP responses.

    Catches any `HTTPException` raised during request handling and returns a response with the appropriate status code and JSON body.

    :param req: the incoming request
    :param handler: the next middleware to be executed
    """
    try:
        return await handler(req)

    except web.HTTPException as exc:
        data = {"id": "_".join(exc.reason.lower().split(" ")), "message": exc.text}

        if exc.reason == "Not Found":
            # standardizes web API 404 error and Jobs API 404 error
            data["message"] = "Not found"

        if isinstance(exc, (InvalidQuery, InvalidInput)):
            data["errors"] = exc.errors

        return json_response(data, exc.status)
