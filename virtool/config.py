import argparse
import json
import logging
import os
import sys
import urllib.parse

import psutil

import virtool.utils

logger = logging.getLogger(__name__)

PATH = os.path.join(sys.path[0], "config.json")

SCHEMA = {
    # HTTP Server
    "host": {
        "type": "string",
        "default": "localhost"
    },
    "port": {
        "type": "integer",
        "coerce": int,
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
        "coerce": int,
        "default": 4
    },
    "mem": {
        "type": "integer",
        "coerce": int,
        "default": 8
    },

    # Job Limits
    "lg_proc": {
        "type": "integer",
        "coerce": int,
        "default": 4
    },
    "lg_mem": {
        "type": "integer",
        "coerce": int,
        "default": 8
    },
    "sm_proc": {
        "type": "integer",
        "coerce": int,
        "default": 2
    },
    "sm_mem": {
        "type": "integer",
        "coerce": int,
        "default": 4
    },

    # MongoDB
    "db_connection_string": {
        "type": "string",
        "default": ""
    },
    "db_name": {
        "type": "string",
        "default": ""
    },

    # Proxy
    "proxy": {
        "type": "string",
        "default": ""
    },

    "force_setup": {
        "type": "boolean",
        "coerce": virtool.utils.to_bool,
        "default": False
    },

    "force_version": {
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

RESOURCE_TYPES = (
    "proc",
    "mem"
)


def coerce(key, value):
    try:
        func = SCHEMA[key]["coerce"]
    except KeyError:
        return value

    return func(value)


def file_exists():
    path = os.path.join(sys.path[0], "config.json")
    return os.path.exists(path)


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
        help="the location to read and write data files to",
        metavar="PATH"
    )

    parser.add_argument(
        "-w", "--watch-path",
        dest="watch_path",
        default=None,
        help="a location to continually retrieve sequencing files from",
        metavar="PATH"
    )

    parser.add_argument(
        "--proc",
        dest="proc",
        default=None,
        help="the processor limit for this Virtool and its subprocesses"
    )

    parser.add_argument(
        "--mem",
        dest="mem",
        default=None,
        help="the memory limit (GB) for this Virtool and its subprocesses"
    )

    parser.add_argument(
        "--db",
        dest="db_connection_string",
        default=None,
        help="the MongoDB connection string"
    )

    parser.add_argument(
        "--db-name",
        dest="db_name",
        default=None,
        help="the MongoDB database name"
    )

    parser.add_argument(
        "--lg-proc",
        dest="lg_proc",
        default=None,
        help="processor limit for large jobs",
        metavar="PROC"
    )

    parser.add_argument(
        "--lg-mem",
        dest="lg_mem",
        default=None,
        help="memory limit for large jobs",
        metavar="MEM"
    )

    parser.add_argument(
        "--sm-proc",
        dest="sm_proc",
        default=None,
        help="processor limit for small jobs",
        metavar="PROC"
    )

    parser.add_argument(
        "--sm-mem",
        dest="sm_mem",
        default=None,
        help="memory limit for small jobs",
        metavar="MEM"
    )

    parser.add_argument(
        "--no-client",
        action="store_true",
        default=False,
        dest="no_client",
        help="run without serving client files"
    )

    parser.add_argument(
        "--no-db-checks",
        action="store_true",
        default=False,
        dest="no_db_checks",
        help="disable validating and repairing database on start"
    )

    parser.add_argument(
        "--no-file-checks",
        action="store_true",
        default=False,
        dest="no_file_checks",
        help="disable checking the application data on start"
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
        help="disable automatic error reporting"
    )

    parser.add_argument(
        "--no-setup",
        action="store_true",
        default=False,
        dest="no_setup",
        help="disable setup on server start"
    )

    parser.add_argument(
        "--force-setup",
        action="store_true",
        default=False,
        dest="force_setup",
        help="force the server to start in setup mode"
    )

    parser.add_argument(
        "--force-version",
        dest="force_version",
        const="v0.0.0",
        help="make the server think it is the passed VERSION (default=v0.0.0)",
        metavar="VERSION",
        nargs="?"
    )

    parser.add_argument(
        "--dev",
        action="store_true",
        default=False,
        dest="dev",
        help="run in dev mode"
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
            settings[key] = os.environ[name]
        except KeyError:
            pass

    return settings


def load_from_file() -> dict:
    try:
        with open(PATH, "r") as f:
            return json.load(f)
    except IOError:
        return dict()


def convert_db(config: dict):
    """
    Convert legacy database settings to a single connection string keyed by `db`. Remove all legacy database settings.

    This function updates `settings in-place.

    :param config: legacy settings

    """
    db_host = config.pop("db_host")
    db_port = config.pop("db_port")
    db_name = config["db_name"]

    auth_string = ""
    ssl_string = ""

    username = config.pop("db_username")
    password = config.pop("db_password")
    use_auth = config.pop("db_use_auth")
    use_ssl = config.pop("db_use_ssl")

    if use_auth and username and password:
        username = urllib.parse.quote_plus(username)
        password = urllib.parse.quote_plus(password)

        auth_string = f"{username}:{password}@"

        # Only use SSL if enabled and auth is configured.
        if use_ssl:
            ssl_string += "?ssl=true"

    config["db_connection_string"] = f"mongodb://{auth_string}{db_host}:{db_port}/{db_name}{ssl_string}"
    config["db_name"] = config["db_name"]


def remove_defaults(config: dict):
    """
    Remove all config pairs where the value matches the default settings. This keeps the config file minimal.

    This function modifies the `config` in-place.

    :param config: config dict

    """
    defaults = get_defaults()

    for key in defaults:
        if key in config and defaults[key] == config[key]:
            config.pop(key, None)


def resolve() -> dict:
    """
    Calculates and returns all non-database-stored settings based on command line options, `settings.json` content,
    and `ENV`.

    :return:

    """
    from_file = load_from_file()
    from_args = get_from_args()
    from_env = get_from_env()
    from_defaults = get_defaults()

    resolved = {**from_defaults, **from_env, **from_file, **from_args}

    coerced = {key: coerce(key, value) for key, value in resolved.items()}

    validate_limits(coerced)

    return coerced


def should_do_setup(config):
    if config["force_setup"]:
        return True

    if config["no_setup"]:
        return False

    return not file_exists()


def validate_limits(config):
    cpu_count = psutil.cpu_count()
    mem_total = psutil.virtual_memory().total

    proc = int(config["proc"])
    mem = int(config["mem"])

    fatal = False

    if proc > cpu_count:
        fatal = True
        logger.fatal(f"Configured proc limit ({proc}) exceeds host CPU count ({cpu_count})")

    in_bytes = mem * 1024 * 1024 * 1024

    if in_bytes > mem_total:
        fatal = True
        logger.fatal(f"Configured mem limit ({in_bytes}) exceeds host memory ({mem_total})")

    for job_limit_key in JOB_LIMIT_KEYS:
        resource_key = job_limit_key.split("_")[1]

        job_limit = int(config[job_limit_key])
        host_limit = int(config[resource_key])

        if job_limit > host_limit:
            fatal = True
            logger.fatal(
                f"Configured {job_limit_key} ({job_limit}) exceeds instance {resource_key} limit ({host_limit})"
            )

    if fatal:
        sys.exit(1)

    return cpu_count, mem_total


def write_to_file(data):
    with open(PATH, "w") as f:
        json_string = json.dumps(data, indent=4, sort_keys=True)
        f.write(json_string)



