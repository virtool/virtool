import argparse
import json
import logging
import os
import pymongo
import sys
from typing import Union

import cerberus

import virtool.db.settings
import virtool.db.utils
import virtool.resources
import virtool.settings

logger = logging.getLogger(__name__)

PATH = os.path.join(sys.path[0], "config.json")

LEGACY_PATH = os.path.join(sys.path[0], "settings.json")

SCHEMA = {
    # HTTP Server
    "host": {
        "type": "string",
        "default": "localhost"
    },
    "port": {
        "type": "integer",
        "default": 9950
    },

    # File paths
    "data_path": {
        "type": "string",
        "default": "data"
    },
    "watch_path": {
        "type": "string",
        "default": "watch"
    },

    # Host resource limits
    "proc": {
        "type": "integer",
        "default": 8
    },
    "mem": {
        "type": "integer",
        "default": 16
    },

    # MongoDB
    "db": {
        "type": "string",
        "default": ""
    },

    # Proxy
    "proxy": {
        "type": "string",
        "default": ""
    }
}

JOB_LIMIT_KEYS = (
    "lg_proc",
    "lg_mem",
    "sm_proc",
    "sm_mem"
)


def check_limits(proc: int, mem: int, settings: dict) -> Union[str, None]:
    """
    Return an error message if the `proc` or `mem` values exceed real system resources or any task-specific
    limits.

    :param proc: processor count
    :param mem: memory in gigabytes
    :param settings: the server settings
    :return: an error message if applicable

    """
    if proc or mem:

        resources = virtool.resources.get()

        if proc:
            if proc > len(resources["proc"]):
                return "Exceeds system processor count"

            if proc < max(settings[key] for key in JOB_LIMIT_KEYS if "_proc" in key):
                return "Less than a task-specific proc limit"

        if mem:
            if mem > resources["mem"]["total"] / 1000000000:
                return "Exceeds system memory"

            if mem < max(settings[key] for key in JOB_LIMIT_KEYS if "_mem" in key):
                return "Less than a task-specific mem limit"


def get_defaults():
    return {key: SCHEMA[key]["default"] for key in SCHEMA}


def get_from_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "-H", "--host",
        dest="host",
        default=None,
        help="the hostname the HTTP server should listen on"
    )

    parser.add_argument(
        "-p", "--port",
        dest="port",
        default=None,
        help="the port the HTTP server should listen on"
    )

    parser.add_argument(
        "-d", "--data-path",
        dest="data_path",
        default=None,
        help="the location to read and write data files to"
    )

    parser.add_argument(
        "-w", "--watch-path",
        dest="watch_path",
        default=None,
        help="a location to continually retrieve sequencing files from"
    )

    parser.add_argument(
        "-c", "--proc",
        dest="proc",
        default=None,
        help="the processor limit for this Virtool and its subprocesses"
    )

    parser.add_argument(
        "-m", "--mem",
        dest="mem",
        default=None,
        help="the memory limit (GB) for this Virtool and its subprocesses"
    )

    parser.add_argument(
        "--db-host",
        dest="db_host",
        default=None,
        help="the MongoDB host"
    )

    parser.add_argument(
        "--db-port",
        dest="db_port",
        default=None,
        help="the MongoDB port"
    )

    parser.add_argument(
        "--db-name",
        dest="db_name",
        default=None,
        help="the name of the database to use"
    )

    parser.add_argument(
        "--db-username",
        dest="db_username",
        default=None,
        help="username to use for accessing MongoDB"
    )

    parser.add_argument(
        "--db-password",
        dest="db_password",
        default=None,
        help="password to use for accessing MongoDB"
    )

    parser.add_argument(
        "--db-auth",
        dest="db_use_auth",
        default=None,
        help="use auth parameters to connect to database"
    )

    parser.add_argument(
        "--lg-proc",
        dest="lg_proc",
        default=None,
        help="processor limit for large jobs"
    )

    parser.add_argument(
        "--lg-mem",
        dest="lg_mem",
        default=None,
        help="memory limit for large jobs"
    )

    parser.add_argument(
        "--sm-proc",
        dest="sm_proc",
        default=None,
        help="processor limit for small jobs"
    )

    parser.add_argument(
        "--sm-mem",
        dest="sm_mem",
        default=os.environ.get("VT_SM_MEM"),
        help="memory limit for small jobs"
    )

    parser.add_argument(
        "--no-db-checks",
        action="store_true",
        default=False,
        dest="no_db_checks",
        help="disable automatic checking for reference, HMM, and software releases"
    )

    parser.add_argument(
        "--no-file-manager",
        action="store_true",
        default=False,
        dest="no_file_manager",
        help="disable the file manager"
    )

    parser.add_argument(
        "--no-job-manager",
        action="store_true",
        default=False,
        dest="no_job_manager",
        help="disable the job manager"
    )

    parser.add_argument(
        "--no-refreshing",
        action="store_true",
        default=False,
        dest="no_refreshing",
        help="disable automatic checking for reference, HMM, and software releases"
    )

    parser.add_argument(
        "--no-sentry",
        action="store_true",
        default=False,
        dest="no_sentry",
        help="disable automatic checking for reference, HMM, and software releases"
    )

    parser.add_argument(
        "--no-setup",
        action="store_true",
        default=False,
        dest="no_setup",
        help="disable setup on server start"
    )

    parser.add_argument(
        "--dev",
        action="store_true",
        default=False,
        dest="dev",
        help="run in dev mode"
    )

    parser.add_argument(
        "-V", "--force-version",
        dest="force_version",
        const="v1.8.5",
        help = "make the server think it is the passed FORCE_VERSION or v1.8.5 if none provided",
        nargs = "?"
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        dest="verbose",
        default=False,
        help="log debug messages"
    )

    args = vars(parser.parse_args())

    return {key: value for key, value in args.items() if value is not None}


def get_from_env() -> dict:
    settings = dict()

    for key in SCHEMA:
        name = "VT_" + key.upper()

        try:
            settings[name] = os.environ[name]
        except KeyError:
            pass

    return settings


def load_from_file() -> dict:
    try:
        with open(PATH, "r") as f:
            return json.load(f)
    except IOError:
        logger.info("No config file found. Entering setup. Use --no-setup to skip setup interface.")
        return dict()


def migrate():
    """
    Migrates old settings style to that introduced in `v3.3.0`.

    - moves database-stored settings that are still in `settings.json` to `settings` database collection.
    - changes name of config file from `settings.json` to `config.json`
    - writes only non-default config values to `config.json`

    """
    # Load the legacy `settings.json` file. Return immediately if it is not found.
    try:
        with open(LEGACY_PATH, "r") as f:
            settings = json.load(f)
    except IOError:
        return None

    db_string = virtool.db.utils.get_connection_string(settings)

    db = pymongo.MongoClient(db_string)

    # Move settings that should be in database to database.
    v = cerberus.Validator(virtool.settings.SCHEMA, purge_unknown=True)
    v.validate(settings)

    db.settings.insert_one({"_id": "settings", **v.document})

    # Rewrite settings file without DB-stored settings.
    v = cerberus.Validator(schema=SCHEMA, purge_unknown=True)
    v.validate(settings)

    # Get default values from schema.
    defaults = get_defaults()

    to_file = dict(v.document)

    to_file["host"] = v.document.pop("server_host")
    to_file["port"] = v.document.pop("server_port")

    # Transform proxy settings into a single connection string. Remove the old settings keys.
    to_file["proxy"] = virtool.settings.create_proxy_string(to_file)

    to_file = {key: value for key, value in to_file.items() if "proxy_" not in key}

    # Only write non-default values to `config.json`.
    to_file = {key: value for key, value in v.document.items() if value != defaults[key]}

    virtool.args.write_to_file(to_file)

    os.remove(LEGACY_PATH)


def resolve() -> dict:
    """
    Calculates and returns all non-database-stored settings based on command line options, `settings.json` content,
    and `ENV`.

    :return:

    """
    migrate()

    from_file = load_from_file()

    from_args = get_from_args()

    return {**from_file, **from_args}


def validate(data: dict) -> dict:
    v = cerberus.Validator(SCHEMA, purge_unknown=True)

    if not v.validate(data):
        logger.critical("Could not validate settings file", v.errors)

        for error in v.errors:
            logger.critical(f"\t{error}")

        sys.exit(1)

    return v.document


def write_to_file(data):
    with open(PATH, "w") as f:
        json_string = json.dumps(data, indent=4, sort_keys=True)
        f.write(json_string)



