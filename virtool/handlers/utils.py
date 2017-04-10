import json
import datetime

from aiohttp import web
from cerberus import Validator
from virtool.permissions import PERMISSIONS


class CustomEncoder(json.JSONEncoder):

    def default(self, obj):
        if isinstance(obj, datetime.datetime):
            return obj.replace(tzinfo=datetime.timezone.utc).isoformat().replace("+00:00", "Z")

        return json.JSONEncoder.default(self, obj)


async def unpack_request(request):
    return request.app["db"], await request.json()


def dumps(obj):
    """
    A wrapper for :func:`json.dumps` that applies pretty formatting to the output. Used as ``dumps`` argument for
    :func:`.json_response`.
    
    :param obj: a JSON-serializable object    
    :type obj: object
    
    :return: a JSON string    
    :rtype: str
     
    """
    return json.dumps(obj, indent=4, sort_keys=True, cls=CustomEncoder)


def json_response(data, status=200):
    """
    A wrapper for ``aiohttp.web.json_response`` that uses :func:``.dumps`` to pretty format the JSON response.
    
    :param data: the data to send in the response as JSON
    :type data: object
    
    :param status: the HTTP status code for the response
    :type status: int
    
    :return: the response
    :rtype: :class:`aiohttp.web.Response`
      
    """
    return web.json_response(data, status=status, dumps=dumps)


def bad_request(message="Bad request"):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``400`` status the JSON body
    ``{"message": "Bad request"}``.
    
    :param message: text to send instead of 'Bad request'
    :type message: str

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({"message": message}, status=400)


def not_found(message="Not found"):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``404`` status the JSON body
    ``{"message": "Not found"}``.
     
    :param message: text to send instead of 'Not found'
    :type message: str

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({"message": message}, status=404)


def requires_login():
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``400`` status the JSON body
    ``{"message": "Requires login"}``.    

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({"message": "Requires login"}, status=400)


def invalid_input(errors):
    """
    A shortcut for creating a :class:`~aiohttp.web.Response` object with a ``422`` status the JSON body
    ``{"message": "Invalid input", "errors": <errors>}``.    
    
    :param errors: error output from a :class:`cerberus.Validator` that led to the error response
    :type errors: dict

    :return: the response
    :rtype: :class:`aiohttp.Response`

    """
    return json_response({"message": "Invalid input", "errors": errors}, status=422)


def protected(required_perm):
    if required_perm not in PERMISSIONS:
        raise ValueError("Permission {} is not valid".format(required_perm))

    def decorator(handler):
        async def wrapped(req):
            if not req["session"].user_id:
                return json_response({"message": "Not authorized"}, status=403)

            if not req["session"].permissions[required_perm]:
                return json_response({"message": "Not permitted"}, status=403)

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


async def unpack_json_request(req):
    """
    A shortcut for pulling the app database reference and the request JSON body from a :class:`~aiohttp.web.Request`
    object.

    :param req: a request
    :type req: :class:`~aiohttp.web.Request`

    :return: the app DB connection and the request JSON body
    :rtype: tuple

    """
    return req.app["db"], await req.json()
