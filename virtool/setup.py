import copy
import logging
import os
import sys
from urllib.parse import quote_plus

import motor.motor_asyncio
from aiohttp import web
from cerberus import Validator
from mako.template import Template
from pymongo.errors import ConnectionFailure, OperationFailure, ServerSelectionTimeoutError

import virtool.settings
import virtool.users
import virtool.utils
from virtool.api.utils import json_response

DATA_ERRORS = {
    "data_not_found_error": False,
    "data_not_empty_error": False,
    "data_permission_error": False
}

DB_ERRORS = {
    "db_auth_error": False,
    "db_connection_error": False,
    "db_host_error": False,
    "db_name_error": False,
    "db_port_error": False,
    "db_not_empty_error": False
}

DB_VALUES = {
    "db_host": "",
    "db_port": 0,
    "db_username": "",
    "db_password": "",
    "db_name": "",
    "db_use_auth": False,
    "db_use_ssl": False
}

FIRST_USER_VALUES = {
    "first_user_id": "",
    "first_user_password": ""
}

WATCH_ERRORS = {
    "watch_not_empty_error": False,
    "watch_not_found_error": False,
    "watch_permission_error": False
}

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
    app.router.add_static("/static", app["client_path"])
    app.router.add_get(r"/{suffix:.*}", setup_redirect)


def create_connection_string(username, password, host, port, db_name, use_ssl):
    string = "mongodb://{}:{}@{}:{}/{}".format(
        quote_plus(username),
        quote_plus(password),
        host,
        port,
        db_name
    )

    if use_ssl:
        string += "?ssl=true"

    return string


def report_error(req, key):
    req.app["setup"].update(DB_VALUES)
    req.app["setup"]["errors"].update({
        **DB_ERRORS,
        key: True
    })

    return web.HTTPFound("/setup")


async def unavailable(req):
    return json_response({
        "id": "requires_setup",
        "message": "Server is not configured"
    }, status=503, headers={"Location": "/setup"})


async def setup_redirect(req):
    return web.HTTPFound("/setup")


async def setup_get(req):
    template = Template(filename=os.path.join(sys.path[0], "templates", "setup.html"))

    setup = copy.deepcopy(req.app["setup"])

    if setup["first_user_password"]:
        setup["first_user_password"] = "dummy password"

    html = template.render(hash=virtool.utils.get_static_hash(req.app["client_path"]), setup=setup)

    return web.Response(body=html, content_type="text/html")


async def setup_db(req):
    data = await req.post()

    db_host = data.get("db_host", None) or "localhost"

    try:
        db_port = int(data.get("db_port", 0) or 27017)
    except ValueError as err:
        if "invalid literal for int" in str(err):
            return report_error(req, "db_port_error")

        raise

    db_name = data["db_name"] or "virtool"

    if "." in db_name:
        return report_error(req, "db_name_error")

    db_username = data["db_username"] or ""
    db_password = data["db_password"] or ""
    use_auth = bool(db_username or db_password)
    use_ssl = bool(data.get("db_use_ssl", False))

    if use_auth:
        if not db_username:
            return report_error(req, "db_username_error")

        if not db_username:
            return report_error(req, "db_password_error")

        string = create_connection_string(
            db_username,
            db_password,
            db_host,
            db_port,
            db_name,
            use_ssl
        )

        try:
            client = motor.motor_asyncio.AsyncIOMotorClient(
                string,
                serverSelectionTimeoutMS=1500,
                io_loop=req.app.loop
            )
        except (ConnectionFailure, ServerSelectionTimeoutError, TypeError, ValueError) as err:
            logger.debug(str(err))
            return report_error(req, "db_connection_error")

    else:
        try:
            # Try to make a connection to the MongoDB instance. This will throw a ConnectionFailure exception if it
            # fails
            client = motor.motor_asyncio.AsyncIOMotorClient(
                io_loop=req.app.loop,
                host=db_host,
                port=db_port,
                serverSelectionTimeoutMS=1500,
                connect=True
            )
        except (ConnectionFailure, ServerSelectionTimeoutError, TypeError, ValueError) as err:
            logger.debug(str(err))
            return report_error(req, "db_connection_error")

    db = client[db_name]

    try:
        collection_names = await db.collection_names(include_system_collections=False)
    except OperationFailure as err:
        if any(substr in str(err) for substr in ["Authentication failed", "no users authenticated"]):
            return report_error(req, "db_auth_error")

        raise
    except (ConnectionFailure, ServerSelectionTimeoutError, TypeError, ValueError):
        return report_error(req, "db_connection_error")

    for collection_name in collection_names:
        if await db[collection_name].count():
            return report_error(req, "db_not_empty_error")

    req.app["setup"].update({
        "db_host": db_host,
        "db_port": db_port,
        "db_username": db_username,
        "db_password": db_password,
        "db_name": db_name,
        "db_use_auth": use_auth,
        "db_use_ssl": use_ssl
    })

    req.app["setup"]["errors"].update(DB_ERRORS)

    return web.HTTPFound("/setup")


async def setup_user(req):
    data = await req.post()

    if data["password"] != "dummy_password":
        v = Validator({
            "user_id": {"type": "string", "required": True},
            "password": {"type": "string", "required": True}
        }, allow_unknown=False)

        v.validate(dict(data))

        data = v.document

        req.app["setup"].update({
            "first_user_id": data["user_id"],
            "first_user_password": virtool.users.hash_password(data["password"])
        })

    return web.HTTPFound("/setup")


async def setup_data(req):
    data = await req.post()

    v = Validator({
        "data_path": {"type": "string", "coerce": lambda x: x if x else "data", "required": True}
    }, allow_unknown=False)

    v.validate(dict(data))

    data_path = v.document["data_path"]

    req.app["setup"]["data_path"] = ""

    req.app["setup"]["errors"].update(DATA_ERRORS)

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
        try:
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

    except PermissionError:
        req.app["setup"]["errors"]["data_permission_error"] = True

    return web.HTTPFound("/setup")


async def setup_watch(req):
    data = await req.post()

    v = Validator({
        "watch_path": {"type": "string", "coerce": lambda x: x if x else "watch", "required": True}
    }, allow_unknown=False)

    v.validate(dict(data))

    watch_path = v.document["watch_path"]

    req.app["setup"]["watch_path"] = ""
    req.app["setup"]["errors"].update(WATCH_ERRORS)

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
        try:
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

    except PermissionError:
        req.app["setup"]["errors"]["watch_permission_error"] = True

    return web.HTTPFound("/setup")


async def clear(req):
    req.app["setup"] = {
        **DB_VALUES,
        **FIRST_USER_VALUES,
        "data_path": "",
        "watch_path": "",
        "errors": {
            **DB_ERRORS,
            **DATA_ERRORS,
            **WATCH_ERRORS
        }
    }

    return web.HTTPFound("/setup")


async def save_and_reload(req):
    data = req.app["setup"]

    if data["db_use_auth"]:
        string = create_connection_string(
            data["db_username"],
            data["db_password"],
            data["db_host"],
            data["db_port"],
            data["db_name"],
            data["db_use_ssl"]
        )

        client = motor.motor_asyncio.AsyncIOMotorClient(
            string,
            serverSelectionTimeoutMS=1500,
            io_loop=req.app.loop
        )
    else:
        client = motor.motor_asyncio.AsyncIOMotorClient(
            io_loop=req.app.loop,
            host=data["db_host"],
            port=data["db_port"]
        )

    db = client[data["db_name"]]

    user_id = req.app["setup"]["first_user_id"]

    await db.users.insert_one({
        "_id": user_id,
        # A list of group _ids the user is associated with.
        "administrator": True,
        "groups": list(),
        "identicon": virtool.users.calculate_identicon(user_id),
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": False,
            "show_versions": False,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        },
        "permissions": {p: True for p in virtool.users.PERMISSIONS},
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

    sub_dirs = [
        "files",
        "references",
        "subtractions",
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

    for subdir in sub_dirs:
        os.makedirs(os.path.join(data_path, subdir))

    settings_dict = {key: data[key] for key in [
        *DB_VALUES.keys(),
        "data_path",
        "watch_path"
    ]}

    settings_path = os.path.join(sys.path[0], "settings.json")

    await virtool.settings.write_settings_file(settings_path, settings_dict)

    req.app["events"]["restart"].set()

    return web.HTTPFound("/")
