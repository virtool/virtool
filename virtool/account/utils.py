"""
Utility functions for working with accounts.

"""
import uuid
from typing import Tuple

import virtool.users.utils


def generate_api_key() -> Tuple[str, str]:
    """
    Generate an API key using UUID. Returns a `tuple` containing the raw API key to be returned once to the user and the
    SHA-256 hash of the API key to be stored in the database.

    :return: a new API key and its hash

    """
    raw = uuid.uuid4().hex
    return raw, virtool.users.utils.hash_api_key(raw)
