"""update subtraction nicknames, created_at and file names

Revision ID: oxu8ghlvuqmh
Date: 2024-11-21 18:03:09.177151

"""

import arrow

from virtool.migration import MigrationContext

# Revision identifiers.
name = "update subtraction nicknames created_at and file names"
created_at = arrow.get("2024-11-21 18:03:09.177151")
revision_id = "oxu8ghlvuqmh"

alembic_down_revision = "b79c1e6cf56c"
virtool_down_revision = None

# Change this if an Alembic revision is required to run this migration.
required_alembic_revision = None


async def upgrade(ctx: MigrationContext):
    async with (
        await ctx.mongo.client.start_session() as mongo_session,
        mongo_session.start_transaction(),
    ):
        await ctx.mongo.subtraction.update_many(
            {"nickname": {"$exists": False}},
            {"$set": {"nickname": ""}},
            session=mongo_session,
        )

    async with (
        await ctx.mongo.client.start_session() as mongo_session,
        mongo_session.start_transaction(),
    ):
        await ctx.mongo.subtraction.update_many(
            {"file.name": None},
            update=[
                {
                    "$set": {
                        "file.name": "$file.id",
                    },
                },
            ],
            session=mongo_session,
        )

    async for subtraction in ctx.mongo.subtraction.find(
        {"created_at": {"$exists": False}},
    ):
        index_stats = (
            ctx.data_path
            / "subtractions"
            / subtraction["_id"].replace(" ", "_")
            / "subtraction.1.bt2"
        ).stat()

        created_at = (
            index_stats.st_ctime
            if index_stats.st_ctime < index_stats.st_mtime
            else index_stats.st_mtime
        )

        await ctx.mongo.subtraction.update_one(
            {"_id": subtraction["_id"]},
            {"$set": {"created_at": arrow.get(created_at).naive}},
        )
