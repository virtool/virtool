"""Add subtractions field

Revision ID: 1keyha5n6l0j
Date: 2022-06-09 22:04:28.890559

"""

import arrow
from pymongo import UpdateOne

from virtool.migration import MigrationContext

name = "Add subtractions field"
created_at = arrow.get("2022-06-09 22:04:28.890559")
revision_id = "1keyha5n6l0j"

alembic_down_revision = None
virtool_down_revision = "7emq1brv0zz6"


async def upgrade(ctx: MigrationContext):
    for collection in (ctx.mongo.analyses, ctx.mongo.samples):
        updates = []

        async for document in collection.find({"subtraction": {"$exists": True}}):
            try:
                subtractions = [document["subtraction"]["id"]]
            except TypeError:
                subtractions = []

            update = UpdateOne(
                {"_id": document["_id"]},
                {"$set": {"subtractions": subtractions}, "$unset": {"subtraction": ""}},
            )

            updates.append(update)

        if updates:
            await collection.bulk_write(updates)
