import json
import motor
import pymongo
import logging

import virtool.gen
import virtool.utils
import virtool.database

logger = logging.getLogger(__name__)


DEFAULTS = [

    ("data_path", "data"),
    ("watch_path", "watch"),

    ("proc", 8),
    ("mem", 16),

    ("pathoscope_bowtie_proc", 6),
    ("pathoscope_bowtie_mem", 16),
    ("pathoscope_bowtie_inst", 6),

    ("pathoscope_snap_proc", 6),
    ("pathoscope_snap_mem", 16),
    ("pathoscope_snap_inst", 6),

    ("nuvs_proc", 6),
    ("nuvs_mem", 16),
    ("nuvs_inst", 6),

    ("import_reads_proc", 4),
    ("import_reads_mem", 4),
    ("import_reads_inst", 3),

    ("add_host_proc", 2),
    ("add_host_mem", 4),
    ("add_host_inst", 2),

    ("rebuild_index_proc", 2),
    ("rebuild_index_mem", 4),
    ("rebuild_index_inst", 1),

    ("sample_group", "none"),
    ("sample_group_read", True),
    ("sample_group_write", False),
    ("sample_all_read", True),
    ("sample_all_write", False),
    ("sample_unique_names", True),

    ("db_name", "virtool"),
    ("db_host", "localhost"),
    ("db_port", 27017),

    ("server_host", "localhost"),
    ("server_port", 9650),
    ("server_ready", False),
    ("server_version", "Unknown"),
    ("server_id", virtool.utils.random_alphanumeric(12)),

    ("software_repo", "virtool/virtool"),
    ("database_repo", "virtool/virtool-reference"),

    ("use_ssl", False),
    ("cert_path", ""),
    ("key_path", ""),

    ("restrict_source_types", True),
    ("allowed_source_types", ["isolate", "genotype"]),
    ("use_internal_control", False),
    ("internal_control_id", "")
]

VALID_TYPES = {

    "data_path": str,
    "watch_path": str,

    "proc": int,
    "mem": int,

    "pathoscope_bowtie_proc": int,
    "pathoscope_bowtie_mem": int,
    "pathoscope_bowtie_inst": int,

    "pathoscope_snap_proc": int,
    "pathoscope_snap_mem": int,
    "pathoscope_snap_inst": int,

    "nuvs_proc": int,
    "nuvs_mem": int,
    "nuvs_inst": int,

    "import_reads_proc": int,
    "import_reads_mem": int,
    "import_reads_inst": int,

    "add_host_proc": int,
    "add_host_mem": int,
    "add_host_inst": int,

    "rebuild_index_proc": int,
    "rebuild_index_mem": int,
    "rebuild_index_inst": int,

    "sample_group": str,
    "sample_group_read": bool,
    "sample_group_write": bool,
    "sample_all_read": bool,
    "sample_all_write": bool,
    "sample_unique_names": bool,

    "db_name": str,
    "db_host": str,
    "db_port": int,

    "server_host": str,
    "server_port": int,
    "server_ready": bool,
    "server_id": str,
    "server_version": str,

    "software_repo": str,
    "database_repo": str,

    "use_ssl": bool,
    "cert_path": str,
    "key_path": str,

    "restrict_source_types": bool,
    "allowed_source_types": list,
    "use_internal_control": bool,
    "internal_control_id": str
}


class ReadOnly:

    def __init__(self, settings_path="./settings.json"):
        self.path = settings_path
        self.data = dict(DEFAULTS)
        self.load_from_file()

    def get(self, key):
        return self.data[key]

    def load_from_file(self):
        """ Load a JSON settings file. If the path cannot be found, generate a new settings file. """
        try:
            # Open file and parse JSON into dictionary.
            with open(self.path, "r") as settings_file:
                string = settings_file.read()
                content = json.loads(string)

            # Check each key in dictionary to make sure it is a valid settings key. Store the key-value pair
            # in self.data for later access
            for key in content:
                if key in VALID_TYPES:
                    self.data[key] = VALID_TYPES[key](content[key])

        except IOError:
            # In case there is no settings file, print self.data to a new settings file. Load default settings value if
            # self.data is not populated (probably the case).
            if not self.data:
                self.data = dict(DEFAULTS)

    def get_db_client(self, sync=False):
        """
        Returns a Mongo client connection based on the database settings for the Virtool instance. Returns a
        `MotorClient <http://motor.readthedocs.org/en/stable/api/motor_client.html>`_ object if sync is ``True`` and a
        `MongoClient <https://api.mongodb.org/python/current/api/pymongo/mongo_client.html>`_ object if sync is
        ``False``.

        :param sync: should the connection use pymongo instead or motor?
        :type sync: bool

        :return: a client object.

        """
        host = self.get("db_host")
        port = self.get("db_port")
        name = self.get("db_name")

        if sync:
            return pymongo.MongoClient(host, port, serverSelectionTimeoutMS=2000, appname="Virtool")[name]

        return motor.MotorClient(host, port, connectTimeoutMS=2000, appname="Virtool")[name]

    def as_dict(self):
        return dict(self.data)


class Simple(ReadOnly):

    def __init__(self, version=None, settings_path="./settings.json"):
        super().__init__(settings_path)

        if version:
            self.data["server_version"] = version
            self.write_to_file()

    def update(self, data):
        """ Update application settings (self.data) from a passed dictionary."""
        old_data = dict(self.data)

        for key, value in data.items():
            try:
                # Get type of setting value
                forced_type = VALID_TYPES[key]
            except KeyError:
                logger.warning("Settings update was called with the unknown key {}".format(key))
                continue

            value = forced_type(value)

            self.data[key] = value

        if self.data != old_data:
            self.write_to_file()
            return dict(self.data)

        return None

    def load_from_file(self):
        """ Load a JSON settings file. If the path cannot be found, generate a new settings file. """
        super().load_from_file()
        self.write_to_file()

    def write_to_file(self):
        """ Write self.data dictionary to a formatted JSON file """
        with open(self.path, "w") as settings_file:
            json.dump(self.data, settings_file, indent=4, sort_keys=True)

    def as_dict(self):
        return dict(self.data)

    def to_read_only(self):
        return ReadOnly(self.path)

    def to_collection(self, dispatch, collections=None, settings=None, add_periodic_callback=None):
        return Collection(dispatch, self.get("server_version"), self.path)


class Collection(Simple):

    def __init__(self, dispatch, version=None, settings_path="./settings.json"):
        super().__init__(version, settings_path)

        #: A reference to the server that instantiated the :class:`.Dispatcher` object.
        self.dispatch = dispatch

        logger.debug("Successfully imported settings")

    @virtool.gen.exposed_method(["modify_options"])
    def set(self, transaction):
        new_settings = yield virtool.gen.THREAD_POOL.submit(self.update, transaction.data)

        if new_settings is not None:
            self.dispatch({
                "operation": "set",
                "collection_name": "settings",
                "data": new_settings
            })

            return True, new_settings

        return False, dict(message="No changes resulted from applying update object")

    @virtool.gen.exposed_method([])
    def download(self, transaction):
        return True, self.as_dict()

    @virtool.gen.synchronous
    def load(self):
        self.load_from_file()
