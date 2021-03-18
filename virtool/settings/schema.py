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


def get_defaults():
    """
    Create a dictionary with key and default values from `SCHEMA` object.

    :return: a dictionary with key and default values from `SCHEMA` object

    """
    return {key: SCHEMA[key]["default"] for key in SCHEMA}
