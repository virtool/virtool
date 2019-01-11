import json
import logging
import os
import sys

import aiofiles
import cerberus

import virtool.resources
import virtool.utils
from virtool.db.settings import PROJECTION

logger = logging.getLogger(__name__)

PATH = os.path.join(sys.path[0], "settings.json")


def get_default_boolean(default):
    return {"type": "boolean", "coerce": virtool.utils.to_bool, "default": default}


def get_default_integer(default):
    return {"type": "integer", "coerce": int, "default": default}


DEFAULT_ANALYSIS_PROC = get_default_integer(6)
DEFAULT_ANALYSIS_MEM = get_default_integer(16)
DEFAULT_ANALYSIS_INST = get_default_integer(6)

API_SCHEMA = {
    # Samples
    "sample_group": {"type": "string", "default": "none"},
    "sample_group_read": get_default_boolean(True),
    "sample_group_write": get_default_boolean(False),
    "sample_all_read": get_default_boolean(True),
    "sample_all_write": get_default_boolean(False),
    "sample_unique_names": get_default_boolean(True),

    # HMM
    "hmm_slug": {
        "type": "string",
        "default": "virtool/virtool-hmm"
    },

    "enable_api": {"type": "boolean", "default": False},

    # External Services
    "enable_sentry": {"type": "boolean", "default": True},

    # Software Updates
    "software_channel": {"type": "string", "default": "stable", "allowed": ["stable", "alpha", "beta"]},

    # Accounts
    "minimum_password_length": {"type": "integer", "default": 8},

    # Reference settings
    "default_source_types": {"type": "list", "default": ["isolate", "strain"]}
}

FILE_SCHEMA = {
    # File paths
    "data_path": {"type": "string", "default": "data"},
    "watch_path": {"type": "string", "default": "watch"},

    # Host resource limits
    "proc": get_default_integer(8),
    "mem": get_default_integer(16),

    # Task-specific settings
    "dummy_proc": get_default_integer(1),
    "dummy_mem": get_default_integer(1),
    "dummy_inst": get_default_integer(5),
    "pathoscope_bowtie_proc": DEFAULT_ANALYSIS_PROC,
    "pathoscope_bowtie_mem": DEFAULT_ANALYSIS_MEM,
    "pathoscope_bowtie_inst": DEFAULT_ANALYSIS_INST,
    "nuvs_proc": DEFAULT_ANALYSIS_PROC,
    "nuvs_mem": DEFAULT_ANALYSIS_MEM,
    "nuvs_inst": DEFAULT_ANALYSIS_INST,
    "create_sample_proc": get_default_integer(4),
    "create_sample_mem": get_default_integer(4),
    "create_sample_inst": get_default_integer(3),
    "create_subtraction_proc": get_default_integer(2),
    "create_subtraction_mem": get_default_integer(4),
    "create_subtraction_inst": get_default_integer(2),
    "build_index_proc": get_default_integer(2),
    "build_index_mem": get_default_integer(4),
    "build_index_inst": get_default_integer(1),

    # MongoDB
    "db_name": {"type": "string", "default": "virtool"},
    "db_host": {"type": "string", "default": "localhost"},
    "db_port": get_default_integer(27017),
    "db_username": {"type": "string", "default": ""},
    "db_password": {"type": "string", "default": ""},
    "db_use_auth": get_default_boolean(False),
    "db_use_ssl": get_default_boolean(True),

    # HTTP Server
    "server_host": {"type": "string", "default": "localhost"},
    "server_port": get_default_integer(9950),

    # Proxy Server
    "proxy_address": {"type": "string", "default": ""},
    "proxy_enable": get_default_boolean(False),
    "proxy_password": {"type": "string", "default": ""},
    "proxy_username": {"type": "string", "default": ""},
    "proxy_trust": get_default_boolean(False)
}

TASK_SPECIFIC_LIMIT_KEYS = [
    "create_sample_mem",
    "create_sample_proc",
    "create_subtraction_proc",
    "create_subtraction_mem",
    "nuvs_proc",
    "nuvs_mem",
    "pathoscope_bowtie_proc",
    "pathoscope_bowtie_mem",
    "build_index_proc",
    "build_index_mem"
]


def check_resource_limits(proc, mem, settings_data):
    """
    Return an error message if the `proc` or `mem` values exceed real system resources or any task-specific
    limits.

    :param proc: processor count
    :type proc: int

    :param mem: memory in gigabytes
    :type mem: int

    :param settings_data: the server settings
    :type settings_data: dict

    :return: an error message if applicable
    :rtype: Union[str, None]

    """
    if proc or mem:

        resources = virtool.resources.get()

        if proc:
            if proc > len(resources["proc"]):
                return "Exceeds system processor count"

            if proc < max(settings_data[key] for key in TASK_SPECIFIC_LIMIT_KEYS if "_proc" in key):
                return "Less than a task-specific proc limit"

        if mem:
            if mem > resources["mem"]["total"] / 1000000000:
                return "Exceeds system memory"

            if mem < max(settings_data[key] for key in TASK_SPECIFIC_LIMIT_KEYS if "_mem" in key):
                return "Less than a task-specific mem limit"


def check_task_specific_limits(proc, mem, update):
    """
    Return an error message if an task-specific limits in the `update` exceed the instance resource limits.

    :param proc: processor count
    :type proc: int

    :param mem: memory in gigabytes
    :type mem: int

    :param update: the limit update to be applied
    :type update: dict

    :return: ab error message if applicable
    :rtype Union[str, None]

    """
    for key in TASK_SPECIFIC_LIMIT_KEYS:
        if key in update:
            value = update[key]

            if "_proc" in key and value > proc:
                return "Exceeds proc resource limit"

            if "_mem" in key and value > mem:
                return "Exceeds mem resource specific limit"


async def load(self):
    await self._migrate()

    # Load settings from the database.
    self._from_db = await self.load_from_db()

    # Load settings from `settings.json`.
    from_file = await self._load_from_file()
    self._from_file = self.validate_file(from_file)


async def load_from_db(app):
    await migrate(app)

    settings = await app["db"].settings.find_one("settings", projection=PROJECTION)

    if settings:
        return settings

    return dict()


async def load_from_file():
    try:
        async with aiofiles.open(PATH, "r") as f:
            return json.loads(await f.read())
    except IOError:
        logger.info("No settings file found. Using defaults.")
        return dict()


async def migrate(app):
    db = app["db"]

    if await db.settings.count({"_id": "settings"}):
        return

    from_file = await load_from_file()

    # Move settings stored in DB to database.
    v = cerberus.Validator(API_SCHEMA, purge_unknown=True)
    v.validate(from_file)

    await db.settings.insert_one({"_id": "settings", **v.document})

    # Rewrite settings file without DB-stored settings.
    v = cerberus.Validator(schema=FILE_SCHEMA, purge_unknown=True)
    v.validate(from_file)

    async with aiofiles.open(PATH, "w") as f:
        json_string = json.dumps(v.document, indent=4, sort_keys=True)
        await f.write(json_string)


def validate_file(data):
    v = cerberus.Validator(FILE_SCHEMA, purge_unknown=True)

    if not v.validate(data):
        logger.critical("Could not validate settings file", v.errors)

        for error in v.errors:
            logger.critical(f"\t{error}")

        sys.exit(1)

    return v.document
