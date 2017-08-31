import os
import sys
import json
import logging
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
    "data_path": {"type": "string", "default": "data"},
    "watch_path": {"type": "string", "default": "watch"},

    "proc": get_default_integer(8),
    "mem": get_default_integer(16),

    "dummy_proc": get_default_integer(1),
    "dummy_mem": get_default_integer(1),
    "dummy_inst": get_default_integer(5),

    "pathoscope_bowtie_proc": DEFAULT_ANALYSIS_PROC,
    "pathoscope_bowtie_mem": DEFAULT_ANALYSIS_MEM,
    "pathoscope_bowtie_inst": DEFAULT_ANALYSIS_INST,

    "nuvs_proc": DEFAULT_ANALYSIS_PROC,
    "nuvs_mem": DEFAULT_ANALYSIS_MEM,
    "nuvs_inst": DEFAULT_ANALYSIS_INST,

    "import_reads_proc": get_default_integer(4),
    "import_reads_mem": get_default_integer(4),
    "import_reads_inst": get_default_integer(3),

    "create_subtraction_proc": get_default_integer(2),
    "create_subtraction_mem": get_default_integer(4),
    "create_subtraction_inst": get_default_integer(2),

    "rebuild_index_proc": get_default_integer(2),
    "rebuild_index_mem": get_default_integer(4),
    "rebuild_index_inst": get_default_integer(1),

    "sample_group": {"type": "string", "default": "none"},
    "sample_group_read": get_default_boolean(True),
    "sample_group_write": get_default_boolean(False),
    "sample_all_read": get_default_boolean(True),
    "sample_all_write": get_default_boolean(False),
    "sample_unique_names": get_default_boolean(True),

    "db_name": {"type": "string", "default": "virtool"},
    "db_host": {"type": "string", "default": "localhost"},
    "db_port": get_default_integer(27017),

    "server_host": {"type": "string", "default": "localhost"},
    "server_port": get_default_integer(9950),

    "software_repo": {"type": "string", "default": "virtool/virtool"},
    "database_repo": {"type": "string", "default": "virtool/virtool-database"},

    "use_ssl": get_default_boolean(False),
    "cert_path": {"type": "string", "default": ""},
    "key_path": {"type": "string", "default": ""},

    "restrict_source_types": get_default_boolean(True),
    "allowed_source_types": {"type": "list", "default": ["isolate", "genotype"]},
    "use_internal_control": get_default_boolean(False),
    "internal_control_id": {"type": "string", "default": ""}
}


class Settings:

    def __init__(self, loop):
        self.loop = loop
        self.data = None
        self.path = "./settings.json"

    def get(self, key):
        return self.data[key]

    def set(self, key, value):
        self.data[key] = value
        return self.data

    async def load(self):
        await self.loop.run_in_executor(None, self.load_from_file)

    def load_from_file(self):
        """ Load a JSON settings file. If the path cannot be found, generate a new settings file. """
        content = {}

        try:
            # Open file and parse JSON into dictionary.
            with open(self.path, "r") as settings_file:
                string = settings_file.read()
                content = json.loads(string)
        except IOError:
            pass

        v = Validator(SCHEMA, purge_unknown=True)

        if not v.validate(content):
            raise ValueError("Could not validate settings file", v.errors)

        self.data = v.document
        write_to_file(self.data, self.path)

    async def write(self):
        await self.loop.run_in_executor(None, write_to_file, self.data, self.path)

    def as_dict(self):
        return dict(self.data)


def write_to_file(settings_dict, path=None):
    path = path or os.path.join(sys.path[0], "settings.json")

    with open(path, "w") as settings_file:
        json.dump(settings_dict, settings_file, indent=4, sort_keys=True)
