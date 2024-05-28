"""
set subtractions field in for analysis documents

Revision ID: io3dep44jtym
Date: 2024-05-27 20:43:33.597733

"""

import arrow
from virtool.migration import MigrationContext

# Revision identifiers.
name = "set deleted field for subtraction documents"
created_at = arrow.get("2024-05-27 20:43:33.597733")
revision_id = "io3dep44jtym"

alembic_down_revision = None
virtool_down_revision = "ulapmx8i3vpg"

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    ctx.mongo.subtraction.update_many(
        {"deleted": {"$exists": False}}, {"$set": {"deleted": False}}
    )


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.subtraction.insert_many(
        [
            {
                "_id": "subtraction_1",
                "file": {"id": "file.fa", "name": "file.fa"},
                "gc": {"a": 10, "c": 40, "g": 40, "t": 10, "n": 0},
                "is_host": True,
                "name": "subtraction_1",
                "nickname": "foo",
                "ready": True,
                "user": {"id": "user_1"},
                "deleted": True,
            },
            {
                "_id": "subtraction_2",
                "file": {"id": "file_2.fa", "name": "file_2.fa"},
                "gc": {"a": 10, "c": 35, "g": 30, "t": 10, "n": 15},
                "is_host": True,
                "name": "subtraction_2",
                "nickname": "foo",
                "ready": True,
                "user": {"id": "user_2"},
            },
            {
                "_id": "subtraction_3",
                "file": {"id": "file_3.fa", "name": "file_3.fa"},
                "gc": {"a": 10, "c": 35, "g": 30, "t": 10, "n": 15},
                "is_host": True,
                "name": "subtraction_3",
                "nickname": "foo",
                "ready": True,
                "user": {"id": "user_3"},
                "deleted": False,
            },
        ]
    )

    await upgrade(ctx)

    assert await ctx.mongo.subtraction.find().to_list(None) == snapshot
