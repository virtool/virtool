class MockSettings:

    def __init__(self):
        #: Contains valid settings names and their value types.
        self.valid = {
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

            "server_port": int,
            "server_host": str,
            "server_ready": bool,
            "server_id": str,
            "server_version": str,

            "use_ssl": bool,
            "cert_path": str,
            "key_path": str,

            "restrict_source_types": bool,
            "allowed_source_types": list,
            "use_internal_control": bool,
            "internal_control_id": str
        }

        self.defaults = {
            "data_path": "data",
            "watch_path": "watch",

            "proc": 8,
            "mem": 16,

            "pathoscope_bowtie_proc": 6,
            "pathoscope_bowtie_mem": 16,
            "pathoscope_bowtie_inst": 6,

            "pathoscope_snap_proc": 6,
            "pathoscope_snap_mem": 16,
            "pathoscope_snap_inst": 6,

            "nuvs_proc": 6,
            "nuvs_mem": 16,
            "nuvs_inst": 6,

            "import_reads_proc": 4,
            "import_reads_mem": 4,
            "import_reads_inst": 3,

            "add_host_proc": 2,
            "add_host_mem": 4,
            "add_host_inst": 2,

            "rebuild_index_proc": 2,
            "rebuild_index_mem": 4,
            "rebuild_index_inst": 1,

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
            "server_host": "localhost",
            "server_ready": False,
            "server_version": 0,
            "server_id": "test_settings",

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

    def get(self, key):
        return self.data.get(key)

    def set(self, key, value):
        self.validate_and_set(key, value)

    def update(self, data):
        # Check each key in dictionary to make sure it is a valid settings key. Store the key-value pair
        # in self.data for later access
        for key, value in data.items():
            self.validate_and_set(key, value)

    def validate_and_set(self, key, value):
        if key in self.valid and isinstance(value, self.valid[key]):
            self.data[key] = value

    def reset(self):
        self.data = dict(self.defaults)

    def as_dict(self):
        return dict(self.data)
