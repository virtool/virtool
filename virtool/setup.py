import os
import sys
import copy
import motor.motor_asyncio
import logging
import pymongo.errors
from aiohttp import web
from mako.template import Template
from cerberus import Validator

import virtool.user
import virtool.user_permissions
import virtool.utils
from virtool.handlers.utils import json_response

logger = logging.getLogger(__name__)


def setup_routes(app):
    app.router.add_route("*", r"/api{suffix:.*}", unavailable)
    app.router.add_get(r"/setup", setup_get)
    app.router.add_post(r"/setup/db", setup_db)
    app.router.add_post(r"/setup/user", setup_user)
    app.router.add_post(r"/setup/data", setup_data)
    app.router.add_post(r"/setup/watch", setup_watch)
    app.router.add_get(r"/setup/clear", clear)
    app.router.add_get(r"/setup/save", save_and_reload)
    app.router.add_static("/static", os.path.join(sys.path[0], "client", "dist"))
    app.router.add_get(r"/{suffix:.*}", setup_redirect)


async def unavailable(req):
    return json_response({
        "id": "requires_setup",
        "message": "Server is not configured"
    }, status=503, headers={"Location": "/setup"})


async def setup_redirect(req):
    return web.HTTPFound("/setup")


async def setup_get(req):
    template = Template(filename=os.path.join(sys.path[0], "virtool", "templates", "setup.html"))

    setup = copy.deepcopy(req.app["setup"])

    if setup["first_user_password"]:
        setup["first_user_password"] = "dummy password"

    html = template.render(hash=virtool.utils.get_static_hash(), setup=setup)

    return web.Response(body=html, content_type="text/html")


async def setup_db(req):
    data = await req.post()

    v = Validator({
        "db_host": {"type": "string", "coerce": lambda x: x if x else "localhost", "required": True, "empty": False},
        "db_port": {"type": "integer", "coerce": lambda x: int(x) if x else 27017, "required": True, "empty": False},
        "db_name": {"type": "string", "coerce": lambda x: x if x else "virtool", "required": True, "empty": False}
    }, allow_unknown=False)

    v(dict(data))

    data = v.document

    clear_update = {
        "db_host": None,
        "db_port": None,
        "db_name": None
    }

    try:
        # Try to make a connection to the Mongo instance. This will throw a ConnectionFailure exception if it fails
        connection = motor.motor_asyncio.AsyncIOMotorClient(
            io_loop=req.app.loop,
            host=data["db_host"],
            port=int(data["db_port"]),
            serverSelectionTimeoutMS=1500
        )

        # Succeeds if the connection was successful. Names will always contain at least the 'local' database.
        names = await connection.database_names()

        if data["db_name"] in names:
            req.app["setup"].update(clear_update)
            req.app["setup"]["errors"].update({
                "db_exists_error": True,
                "db_connection_error": False
            })
        else:
            req.app["setup"].update(data)
            req.app["setup"]["errors"].update({
                "db_exists_error": False,
                "db_connection_error": False
            })

    except (pymongo.errors.ConnectionFailure, TypeError, ValueError) as err:
        req.app["setup"].update(clear_update)
        req.app["setup"]["errors"].update({
            "db_exists_error": False,
            "db_connection_error": True
        })

    return web.HTTPFound("/setup")


async def setup_user(req):
    data = await req.post()

    v = Validator({
        "user_id": {"type": "string", "required": True},
        "password": {"type": "string", "required": True},
        "password_confirm": {"type": "string", "required": True},
    }, allow_unknown=False)

    v(dict(data))

    data = v.document

    if data["password"] == data["password_confirm"]:
        req.app["setup"]["errors"]["password_confirmation_error"] = False
        req.app["setup"].update({
            "first_user_id": data["user_id"],
            "first_user_password": virtool.user.hash_password(data["password"])
        })
    else:
        req.app["setup"]["errors"]["password_confirmation_error"] = True
        req.app["setup"].update({
            "first_user_id": None,
            "first_user_password": None
        })

    return web.HTTPFound("/setup")


async def setup_data(req):
    data = await req.post()

    v = Validator({
        "data_path": {"type": "string", "coerce": lambda x: x if x else "data", "required": True}
    }, allow_unknown=False)

    v(dict(data))

    data_path = v.document["data_path"]

    req.app["setup"]["data_path"] = None

    req.app["setup"]["errors"].update({
        "data_not_found_error": False,
        "data_not_empty_error": False,
        "data_permission_error": False
    })

    joined_path = str(data_path)

    if not joined_path.startswith("/"):
        joined_path = os.path.join(sys.path[0], joined_path)

    try:
        os.mkdir(joined_path)
        os.rmdir(joined_path)
        req.app["setup"]["data_path"] = data_path
    except FileNotFoundError:
        req.app["setup"]["errors"]["data_not_found_error"] = True
    except FileExistsError:
        if len(os.listdir(data_path)):
            req.app["setup"]["errors"]["data_not_empty_error"] = True
        else:
            test_path = os.path.join(joined_path, "test")
            try:
                os.mkdir(test_path)
            except PermissionError:
                req.app["setup"]["errors"]["data_permission_error"] = True

    except PermissionError:
        req.app["setup"]["errors"]["data_permission_error"] = True

    return web.HTTPFound("/setup")


async def setup_watch(req):
    data = await req.post()

    v = Validator({
        "watch_path": {"type": "string", "coerce": lambda x: x if x else "watch", "required": True}
    }, allow_unknown=False)

    v(dict(data))

    watch_path = v.document["watch_path"]

    req.app["setup"]["watch_path"] = None

    req.app["setup"]["errors"].update({
        "watch_not_found_error": False,
        "watch_not_empty_error": False,
        "watch_permission_error": False
    })

    joined_path = str(watch_path)

    if not joined_path.startswith("/"):
        joined_path = os.path.join(sys.path[0], joined_path)

    try:
        os.mkdir(joined_path)
        os.rmdir(joined_path)
        req.app["setup"]["watch_path"] = watch_path
    except FileNotFoundError:
        req.app["setup"]["errors"]["watch_not_found_error"] = True
    except FileExistsError:
        if len(os.listdir(watch_path)):
            req.app["setup"]["errors"]["watch_not_empty_error"] = True
        else:
            test_path = os.path.join(joined_path, "test")
            try:
                os.mkdir(test_path)
            except PermissionError:
                req.app["setup"]["errors"]["watch_permission_error"] = True

    except PermissionError:
        req.app["setup"]["errors"]["watch_permission_error"] = True

    return web.HTTPFound("/setup")


async def clear(req):
    req.app["setup"] = {
        "db_host": None,
        "db_port": None,
        "db_name": None,

        "first_user_id": None,
        "first_user_password": None,

        "data_path": None,
        "watch_path": None,

        "errors": {
            "db_exists_error": False,
            "db_connection_error": False,
            "password_confirmation_error": False,
            "data_not_empty_error": False,
            "data_not_found_error": False,
            "data_permission_error": False,
            "watch_not_empty_error": False,
            "watch_not_found_error": False,
            "watch_permission_error": False
        }
    }

    return web.HTTPFound("/setup")

async def save_and_reload(req):
    data = req.app["setup"]

    connection = motor.motor_asyncio.AsyncIOMotorClient(
        io_loop=req.app.loop,
        host=req.app["setup"]["db_host"],
        port=int(req.app["setup"]["db_port"])
    )

    db_name = data["db_name"]

    await connection[db_name].users.insert_one({
        "_id": req.app["setup"]["first_user_id"],
        # A list of group _ids the user is associated with.
        "groups": list(),
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": False,
            "show_versions": False,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        },
        "permissions": {permission: True for permission in virtool.user_permissions.PERMISSIONS},
        "password": req.app["setup"]["first_user_password"],
        "primary_group": "",
        # Should the user be forced to reset their password on their next login?
        "force_reset": False,
        # A timestamp taken at the last password change.
        "last_password_change": virtool.utils.timestamp(),
        # Should all of the user's sessions be invalidated so that they are forced to login next time they
        # download the client.
        "invalidate_sessions": False
    })

    subdirs = [
        "files",
        "reference/viruses",
        "reference/hosts",
        "samples",
        "hmm",
        "logs/jobs"
    ]

    data_path = data["data_path"]

    for path in [data_path, data["watch_path"]]:
        try:
            os.mkdir(path)
        except FileExistsError:
            pass

    for subdir in subdirs:
        os.makedirs(os.path.join(data_path, subdir))

    virtool.utils.reload()

    return web.HTTPFound("/")
