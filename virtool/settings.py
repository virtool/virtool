import os
import json
import logging
import tornado.ioloop

import virtool.gen
import virtool.utils
import virtool.database

logger = logging.getLogger(__name__)


class Settings:

    def __init__(self, server):
        #: A reference to the server that instantiated the :class:`.Dispatcher` object.
        self.server = server

        #: Contains valid settings names and their value types.
        self.valid = {
            "data_path": "str",
            "watch_path": "str",

            "proc": "int",
            "mem": "int",

            "pathoscope_proc": "int",
            "pathoscope_mem": "int",
            "pathoscope_inst": "int",

            "nuvs_proc": "int",
            "nuvs_mem": "int",
            "nuvs_inst": "int",
            
            "import_reads_proc": "int",
            "import_reads_mem": "int",
            "import_reads_inst": "int",
            
            "add_host_proc": "int",
            "add_host_mem": "int",
            "add_host_inst": "int",
            
            "rebuild_proc": "int",
            "rebuild_mem": "int",
            "rebuild_inst": "int",

            "sample_group": "str",
            "sample_group_read": "bool",
            "sample_group_write": "bool",
            "sample_all_read": "bool",
            "sample_all_write": "bool",
            "sample_unique_names": "bool",

            "db_name": "str",
            "db_host": "str",
            "db_port": "int",

            "server_port": "int",
            "server_address": "str",
            "server_ready": "bool",
            "server_id": "str",
            "server_version": "str",

            "use_ssl": "bool",
            "cert_path": "str",
            "key_path": "str",

            "restrict_source_types": "bool",
            "allowed_source_types": "list",
            "use_internal_control": "bool",
            "internal_control_id": "str"
        }

        self.defaults = {
            "data_path": "data",
            "watch_path": "watch",

            "proc": 8,
            "mem": 16,

            "pathoscope_proc": 6,
            "pathoscope_mem": 24,
            "pathoscope_inst": 6,

            "nuvs_proc": 6,
            "nuvs_mem": 24,
            "nuvs_inst": 6,

            "import_reads_proc": 4,
            "import_reads_mem": 4,
            "import_reads_inst": 3,

            "add_host_proc": 2,
            "add_host_mem": 4,
            "add_host_inst": 2,

            "rebuild_proc": 1,
            "rebuild_mem": 4,
            "rebuild_inst": 1,

            "sample_group": "none",
            "sample_group_read": True,
            "sample_group_write": False,
            "sample_all_read": True,
            "sample_all_write": False,
            "sample_unique_names": True,

            "db_name": "virtool",
            "db_host": "localhost",
            "db_port": 27017,

            "server_port": 9650,
            "server_address": "localhost",
            "server_ready": False,
            "server_version": server.version,
            "server_id": virtool.utils.random_alphanumeric(12),

            "use_ssl": False,
            "cert_path": "",
            "key_path": "",

            "restrict_source_types": True,
            "allowed_source_types": ["isolate", "genotype"],
            "use_internal_control": False,
            "internal_control_id": ""
        }

        # Load JSON configuration file to dictionary
        self.data = dict(self.defaults)

        self._load()

        logger.debug("Successfully imported settings")

    @virtool.gen.exposed_method(["modify_options"])
    def set(self, transaction):

        new_settings = yield self.sync_set(transaction.data)

        self.server.dispatcher.dispatch({
            "operation": "set",
            "collection_name": "settings",
            "data": new_settings
        })

        return True, new_settings

    @virtool.gen.exposed_method([])
    def download(self):
        return True, self.as_dict()

    @virtool.gen.synchronous
    def sync_set(self, data):
        """ Update application settings (self.data) from a passed dictionary."""
        keys = list()

        for key, value in data.items():
            # Validate key by checking it against the list of valid keys
            try:
                # Get type of setting value
                force_type = self.valid[key]

                if force_type == "int":
                    value = int(value)
                elif force_type == "float":
                    value = float(value)

                self.data[key] = value
                keys.append(key)
            except KeyError:
                pass

        self.write()

        return {key: self.data[key] for key in keys}

    def get(self, key):
        return self.data[key]

    @virtool.gen.coroutine
    def send(self, connection, transaction):
        # Reload the settings data to make sure it is current
        yield self.load()

        for key, value in self.data.items():
            message = {
                "operation": "add",
                "collection_name": "settings",
                "data": {
                    "_id": key,
                    "value": value
                }
            }

            self.server.dispatcher.dispatch(message, connections=[connection])

        transaction.fulfill()

    @virtool.gen.synchronous
    def load(self):
        self._load()

    def _load(self):
        """ Load a JSON settings file. If the path cannot be found, generate a new settings file. """
        try:
            # Open file and parse JSON into dictionary.
            with open("settings.json", "r") as settings_file:
                string = settings_file.read()
                content = json.loads(string)

            # Check each key in dictionary to make sure it is a valid settings key. Store the key-value pair
            # in self.data for later access
            for key in content:
                if key in self.valid:
                    self.data[key] = content[key]

            self.write()

        except IOError:
            # In case there is no settings files, assign self.data a default option dictionary. Then,
            # print self.data to a new settings file.
            self.data = self.defaults
            self.write()

    def ensure_dirs(self):
        data_path = self.get("data_path")

        paths = [
            data_path,
            data_path + "/samples",
            data_path + "/logs/jobs",
            data_path + "/sessions",
            data_path + "/reference/hosts/fasta",
            data_path + "/reference/hosts/index",
            data_path + "/reference/viruses/temp",

            self.get("watch_path")
        ]

        for path in paths:
            if not os.path.exists(path):
                os.makedirs(path)

    def as_dict(self):
        return dict(self.data)

    def write(self):
        """ Write self.data dictionary to a formatted JSON file """
        with open("settings.json", "w") as settings_file:
            string = json.dumps(self.data)
            settings_file.write(string)
