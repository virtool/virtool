"""Utilities for working with users in the database."""

from virtool.mongo.core import Mongo
from virtool.types import Document
from virtool.users.db import ATTACH_PROJECTION
from virtool.utils import base_processor


async def extend_user(mongo: Mongo, user: Document) -> Document:
    user_data = base_processor(
        await mongo.users.find_one(user["id"], ATTACH_PROJECTION),
    )

    return {
        **user,
        **user_data,
    }
