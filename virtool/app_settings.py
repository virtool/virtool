import os
import sys
import json
import logging
import aiofiles
from cerberus import Validator

from virtool.utils import to_bool


logger = logging.getLogger(__name__)


def get_default_boolean(default):
    return {"type": "boolean", "coerce": to_bool, "default": default}


def get_default_integer(default):
    return {"type": "integer", "coerce": int, "default": default}


DEFAULT_ANALYSIS_PROC = get_default_integer(6)
DEFAULT_ANALYSIS_MEM = get_default_integer(16)
DEFAULT_ANALYSIS_INST = get_default_integer(6)


SCHEMA = {
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
    "rebuild_index_proc": get_default_integer(2),
    "rebuild_index_mem": get_default_integer(4),
    "rebuild_index_inst": get_default_integer(1),

    # Samples
    "sample_group": {"type": "string", "default": "none"},
    "sample_group_read": get_default_boolean(True),
    "sample_group_write": get_default_boolean(False),
    "sample_all_read": get_default_boolean(True),
    "sample_all_write": get_default_boolean(False),
    "sample_unique_names": get_default_boolean(True),

    # MongoDB
    "db_name": {"type": "string", "default": "virtool"},
    "db_host": {"type": "string", "default": "localhost"},
    "db_port": get_default_integer(27017),

    # HTTP Server
    "server_host": {"type": "string", "default": "localhost"},
    "server_port": get_default_integer(9950),
    "enable_api": {"type": "boolean", "default": False},

    # Proxy Server
    "proxy_address": {"type": "string", "default": ""},
    "proxy_enable": get_default_boolean(False),
    "proxy_password": {"type": "string", "default": ""},
    "proxy_username": {"type": "string", "default": ""},
    "proxy_trust": get_default_boolean(False),


    # Github
    "github_token": {"type": "string", "default": ""},
    "github_username": {"type": "string", "default": ""},
    "software_channel": {"type": "string", "default": "stable", "allowed": ["stable", "alpha", "beta"]},

    # Accounts
    "minimum_password_length": {"type": "integer", "default": 8},

    # SSL
    "use_ssl": get_default_boolean(False),
    "cert_path": {"type": "string", "default": ""},
    "key_path": {"type": "string", "default": ""},

    # Virus settings
    "restrict_source_types": get_default_boolean(True),
    "allowed_source_types": {"type": "list", "default": ["isolate", "strain"]},

    # Analysis settings
    "use_internal_control": get_default_boolean(False),
    "internal_control_id": {"type": "string", "default": ""}
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
    "rebuild_index_proc",
    "rebuild_index_mem"
]


async def write_settings_file(path, settings_dict):
    validated = Settings.validate(settings_dict)

    with open(path, "w") as f:
        json.dump(validated, f)


async def attach_virus_name(db, settings):
    internal_control_id = settings.get("internal_control_id")

    virus = None

    if internal_control_id:
        virus = await db.viruses.find_one(internal_control_id, ["name"])

    if not virus:
        settings.set("internal_control_id", "")
        await settings.write()
        return settings.data

    to_send = dict(settings.data)

    to_send["internal_control_id"] = {
        "id": internal_control_id,
        "name": virus["name"]
    }

    return to_send


class Settings:

    def __init__(self):
        self.data = None
        self.path = os.path.join(sys.path[0], "settings.json")

    def __getitem__(self, key):
        return self.data.get(key)

    def __setitem__(self, key, value):
        return self.data.set(key, value)

    def update(self, update_dict):
        self.data.update(update_dict)

    def get(self, *args, **kwargs):
        return self.data.get(*args, **kwargs)

    def set(self, key, value):
        self.data[key] = value
        return self.data

    async def load(self):
        try:
            async with aiofiles.open(self.path, "r") as f:
                content = json.loads(await f.read())
        except IOError:
            content = dict()

        self.data = self.validate(content)

        await self.write()

    async def write(self):
        self.data = self.validate(self.data)

        async with aiofiles.open(self.path, "w") as f:
            json_string = json.dumps(self.data, indent=4, sort_keys=True)
            await f.write(json_string)

    def as_dict(self):
        return dict(self.data)

    @staticmethod
    def validate(data):
        v = Validator(SCHEMA, purge_unknown=True)

        if not v.validate(data):
            raise ValueError("Could not validate settings file", v.errors)

        return v.document
