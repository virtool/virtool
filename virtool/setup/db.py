import logging

import motor.motor_asyncio
from pymongo.errors import ConnectionFailure, OperationFailure, ServerSelectionTimeoutError

import virtool.config
import virtool.settings

import virtool.users
import virtool.utils

logger = logging.getLogger(__name__)


async def add_first_user(db, user_id, password):
    await db.users.insert_one({
        "_id": user_id,
        # A list of group _ids the user is associated with.
        "administrator": True,
        "groups": list(),
        "identicon": virtool.users.calculate_identicon(user_id),
        "settings": {
            "skip_quick_analyze_dialog": True,
            "show_ids": False,
            "show_versions": False,
            "quick_analyze_algorithm": "pathoscope_bowtie"
        },
        "permissions": {p: True for p in virtool.users.PERMISSIONS},
        "password": password,
        "primary_group": "",
        # Should the user be forced to reset their password on their next login?
        "force_reset": False,
        # A timestamp taken at the last password change.
        "last_password_change": virtool.utils.timestamp(),
        # Should all of the user's sessions be invalidated so that they are forced to login next time they
        # download the client.
        "invalidate_sessions": False
    })


async def check_setup(db_connection_string, db_name):
    if "." in db_name:
        return {
            "db_connection_string": db_connection_string,
            "db_name": "",
            "ready": False,
            "error": "name_error"
        }

    db = get_db(db_connection_string, db_name)

    try:
        collection_names = await db.collection_names(include_system_collections=False)
    except OperationFailure as err:
        if any(substr in str(err) for substr in ["Authentication failed", "no users authenticated"]):
            return {
                "db_connection_string": "",
                "db_name": "",
                "ready": False,
                "error": "auth_error"
            }
        raise
    except (ConnectionFailure, ServerSelectionTimeoutError, TypeError, ValueError):
        return {
            "db_connection_string": "",
            "db_name": "",
            "ready": False,
            "error": "connection_error"
        }

    return {
        "db_connection_string": db_connection_string,
        "db_name": db_name,
        "ready": True,
        "error": None
    }


def get_db(db_connection_string, db_name):
    client = motor.motor_asyncio.AsyncIOMotorClient(db_connection_string, serverSelectionTimeoutMS=1500)
    return client[db_name]


async def populate_settings(db):
    defaults = virtool.settings.get_defaults()

    await db.settings.insert_one({
        "_id": "settings",
        **defaults
    })




