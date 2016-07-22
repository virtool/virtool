import os
import motor
import pymongo.errors
import tornado.web

import virtool.gen
import virtool.utils
import virtool.users
import virtool.viruses
import virtool.samples
import virtool.hosts
import virtool.groups


@virtool.gen.coroutine
def handle_request(handler, data):
    try:
        operation = data["operation"]
    except tornado.web.MissingArgumentError:
        raise NameError("No setup operation specified.")

    # Get the function that should be called with the RequestHandler object.
    try:
        function = globals()[operation]
    except KeyError:
        raise KeyError("Could not find specified operation function: " + operation)

    response = yield function(handler, data)

    return response


@virtool.gen.coroutine
def check_ready(handler, data):
    return {"serverReady": handler.settings["server"].settings.get("server_ready")}


@virtool.gen.coroutine
def save_setup(handler,data):
    host = handler.get_body_argument('host')
    port = int(handler.get_body_argument('port'))
    name = handler.get_body_argument('name')
    new_server = handler.get_body_argument("new_server") == 'true'

    db = motor.MotorClient(data["host"], int(data["port"]))[name]

    settings = {
        "db_host": host,
        "db_port": int(port),
        "db_name": name,

        "data_path": data["dataPath"],
        "watch_path": data["watchPath"],

        "server_ready": True
    }

    if new_server:
        collection_names = [
            "jobs",
            "samples",
            "analyses",
            "viruses",
            "indexes",
            "history",
            "hosts",
            "sequences",
            "users",
            "groups"
        ]

        for collection_name in collection_names:
            yield db.create_collection(collection_name)
    try:
        yield virtool.gen.THREAD_POOL.submit(os.makedirs, settings["watch_path"])
    except FileExistsError:
        pass

    yield db.groups.update({"_id": "administrator"}, {
        "$set": {
            "permissions": {permission: True for permission in virtool.groups.PERMISSIONS}
        }
    }, upsert=True)

    username = data["username"]

    if username:
        password = data["password"]

        salt, password = virtool.users.salt_hash(password)

        db.users.insert({
            "_id": username,
            # A list of group _ids the user is associated with.
            "groups": ["administrator"],
            "settings": {},
            "sessions": [],
            "salt": salt,
            "password": password,
            "permissions": {permission: True for permission in virtool.groups.PERMISSIONS},
            # Should the user be forced to reset their password on their next login?
            "force_reset": False,
            # A timestamp taken at the last password change.
            "last_password_change": virtool.utils.timestamp(),
            # Should all of the user's sessions be invalidated so that they are forced to login next time they
            # download the client.
            "invalidate_sessions": False
        })

    handler.settings["server"].settings.sync_set(settings)

    response = yield handler.settings["server"].reload()

    return response


@virtool.gen.coroutine
def connect(handler, data):
    # The response to send to the client. If the connection fails, the names property is set to None. This is
    # interpreted as a failed connection by the client.
    response = {
        "names": None
    }

    try:
        # Try to make a connection to the Mongo instance. This will throw a ConnectionFailure exception if it fails
        connection = motor.MotorClient(host=data["host"], port=int(data["port"]))
        client = yield connection.open()

        # Succeeds if the connection was successful. Names will always contain at least the 'local' database.
        response["names"] = yield client.database_names()

        # Remove the local database that is always present in the list of databases if a connection was made.
        response["names"].remove("local")

    except pymongo.errors.ConnectionFailure:
        pass
    except TypeError:
        pass
    except ValueError:
        pass

    return response


@virtool.gen.coroutine
def check_db(handler, data):
    response = {
        "exists": False,
        "admin": False,
        "collections": False,
        "error": None
    }

    # Try to make a connection to the Mongo instance. This will throw a ConnectionFailure exception if it fails.
    try:
        connection = motor.MotorClient(host=data["host"], port=int(data["port"]))
        client = yield connection.open()
    except pymongo.errors.ConnectionFailure:
        response["error"] = "Could not connect to MongoDB instance."
        return response

    # Check if the passed db_name exists.
    names = yield client.database_names()
    response["exists"] = data["name"] in names

    # Immediately return the response if the database specified by db_name does not exist.
    if not response["exists"]:
        return response

    database = client[data["name"]]

    # Check if there are any administrator users in the database.
    administrator_count = yield database["users"].find({"groups": "administrator"}).count()
    response["admin"] = administrator_count > 0

    # Check if any important collections already exist. A warning will be displayed to the user if so.
    record_counts = 0

    for collection_name in ["samples", "viruses", "jobs", "hosts"]:
        record_counts += yield database[collection_name].count()

    response["collections"] = record_counts > 0

    return response


@virtool.gen.coroutine
def set_data_path(handler, data):
    new_server = data["new_server"] == 'true'

    response = yield virtool.gen.THREAD_POOL.submit(ensure_path, data["path"], new_server)

    if not response["failed"] and not new_server:

        host = handler.get_body_argument('host')
        port = int(handler.get_body_argument('port'))
        name = handler.get_body_argument('name')

        response.update({
            "viruses": virtool.viruses.check_collection(name, data["path"], host, port),
            "samples": virtool.samples.check_collection(name, data["path"], host, port),
            "hosts": virtool.hosts.check_collection(name, data["path"], host, port)
        })

    return response


def ensure_path(path, new_server):
    response = {
        "failed": False,
        "message": None
    }

    subdirs = [
        "upload",
        "reference/viruses",
        "reference/hosts",
        "reference/hosts/index",
        "reference/hosts/fasta",
        "download",
        "samples",
        "hmm",
        "logs/jobs"
    ]

    if new_server:
        try:
            os.makedirs(path)
        except OSError:
            # The path already exists. Check if it is empty. If it isn't, send a failure message to the user.
            if len(os.listdir(path)) > 0:
                response.update({
                    "failed": True,
                    "message": "Path exists already and is not empty. Please remove or empty this directory before "
                               "setting up Virtool"
                })

        # If the data path is created and empty, make all of the required subdirs.
        if not response["failed"]:
            for subdir in subdirs:
                os.makedirs(os.path.join(path, subdir))

    else:
        if not os.path.exists(path):
            response.update({
                "failed": True,
                "message": "Path does not exist. Choose a path containing an existing Virtool data set."
            })
        else:
            for subpath in os.listdir(path):
                if subpath not in ["reference", "samples", "logs", "download", "upload"]:
                    return {
                        "failed": True,
                        "message": "Found unknown subpath " + os.path.join(path, subpath)
                    }

    return response
