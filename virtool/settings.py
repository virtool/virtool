import logging
import virtool.validators

logger = logging.getLogger(__name__)

SCHEMA = {
    # Samples
    "sample_group": {
        "type": "string",
        "default": "none"
    },
    "sample_group_read": {
        "type": "boolean",
        "default": True
    },
    "sample_group_write": {
        "type": "boolean",
        "default": False
    },
    "sample_all_read": {
        "type": "boolean",
        "default": True
    },
    "sample_all_write": {
        "type": "boolean",
        "default": False
    },
    "sample_unique_names": {
        "type": "boolean",
        "default": True
    },

    # HMM
    "hmm_slug": {
        "type": "string",
        "coerce": virtool.validators.strip,
        "default": "virtool/virtool-hmm"
    },

    "enable_api": {
        "type": "boolean",
        "default": False
    },

    # External Services
    "enable_sentry": {
        "type": "boolean",
        "default": True
    },

    # Software Updates
    "software_channel": {
        "type": "string",
        "default": "stable",
        "allowed": [
            "stable",
            "alpha",
            "beta"
        ]
    },

    # Accounts
    "minimum_password_length": {
        "type": "integer",
        "default": 8
    },

    # Reference settings
    "default_source_types": {
        "type": "list",
        "default": [
            "isolate",
            "strain"
        ]
    }
}

LEGACY_SCHEMA = {

    # HTTP Server
    "server_host": {
        "type": "string",
        "default": "localhost"
    },
    "server_port": {
        "type": "integer",
        "default": 9950
    },
    "enable_api": {
        "type": "boolean",
        "default": False
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
    "db_name": {
        "type": "string",
        "default": "virtool"
    },
    "db_host": {
        "type": "string",
        "default": "localhost"
    },
    "db_port": {
        "type": "integer",
        "default": 27017
    },
    "db_username": {
        "type": "string",
        "default": ""
    },
    "db_password": {
        "type": "string",
        "default": ""
    },
    "db_use_auth": {
        "type": "boolean",
        "default": False
    },
    "db_use_ssl": {
        "type": "boolean",
        "default": True
    },

    # HMM
    "hmm_slug": {
        "type": "string",
        "default": "virtool/virtool-hmm"
    },

    # Jobs
    "pathoscope_bowtie_proc": {
        "type": "integer",
        "default": 8
    },
    "pathoscope_bowtie_mem": {
        "type": "integer",
        "default": 16
    },
    "nuvs_proc": {
        "type": "integer",
        "default": 8
    },
    "nuvs_mem": {
        "type": "integer",
        "default": 16
    },
    "create_subtraction_proc": {
        "type": "integer",
        "default": 2
    },
    "create_subtraction_mem": {
        "type": "integer",
        "default": 4
    },
    "build_index_proc": {
        "type": "integer",
        "default": 2
    },
    "build_index_mem": {
        "type": "integer",
        "default": 4
    },

    # Samples
    "sample_group": {
        "type": "string",
        "default": "none"
    },
    "sample_group_read": {
        "type": "boolean",
        "default": True
    },
    "sample_group_write": {
        "type": "boolean",
        "default": False
    },
    "sample_all_read": {
        "type": "boolean",
        "default": True
    },
    "sample_all_write": {
        "type": "boolean",
        "default": False
    },
    "sample_unique_names": {
        "type": "boolean",
        "default": True
    },

    # Proxy
    "proxy_address": {
        "type": "string",
        "default": ""
    },
    "proxy_enable": {
        "type": "boolean",
        "default": False
    },
    "proxy_password": {
        "type": "string",
        "default": ""
    },
    "proxy_username": {
        "type": "string",
        "default": ""
    },
    "proxy_trust": {
        "type": "string",
        "default": False
    },

    # External Services
    "enable_sentry": {
        "type": "boolean",
        "default": True
    },
    "software_channel": {
        "type": "string",
        "default": "stable",
        "allowed": [
            "stable",
            "alpha",
            "beta"
        ]
    },

    # Accounts
    "minimum_password_length": {
        "type": "integer",
        "default": 8
    },

    # Reference settings
    "default_source_types": {
        "type": "list",
        "default": [
            "isolate",
            "strain"
        ]
    }
}


def get_defaults():
    return {key: SCHEMA[key]["default"] for key in SCHEMA}
