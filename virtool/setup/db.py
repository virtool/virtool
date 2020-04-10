import logging

import motor.motor_asyncio
from pymongo.errors import ConnectionFailure, OperationFailure, ServerSelectionTimeoutError

import virtool.config
import virtool.settings.schema

import virtool.users.utils
import virtool.utils

logger = logging.getLogger(__name__)


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
        await db.list_collection_names()
    except OperationFailure as err:
        logger.warning(f"Database Setup: {str(err)}")
        if any(substr in str(err) for substr in ["Authentication failed", "no users authenticated"]):
            return {
                "db_connection_string": "",
                "db_name": "",
                "ready": False,
                "error": "auth_error"
            }
        raise
    except (ConnectionFailure, ServerSelectionTimeoutError, TypeError, ValueError) as err:
        logger.warning(f"Database Setup: {str(err)}")
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
    defaults = virtool.settings.schema.get_defaults()

    await db.settings.delete_one({
        "_id": "settings"
    })

    await db.settings.insert_one({
        "_id": "settings",
        **defaults
    })
