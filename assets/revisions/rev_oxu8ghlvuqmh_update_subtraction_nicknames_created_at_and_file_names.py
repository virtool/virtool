"""update subtraction nicknames, created_at and file names

Revision ID: oxu8ghlvuqmh
Date: 2024-11-21 18:03:09.177151

"""

import datetime

import arrow
from syrupy.matchers import path_type

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
    await ctx.mongo.subtraction.update_many(
        {"nickname": {"$exists": False}},
        {"$set": {"nickname": ""}},
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
            {"$set": {"created_at": datetime.datetime.fromtimestamp(created_at)}},
        )

    await ctx.mongo.subtraction.update_many(
        filter={"file.name": None},
        update=[
            {
                "$set": {
                    "file.name": "$file.id",
                },
            },
        ],
    )


async def test_upgrade(ctx: MigrationContext, snapshot):
    await ctx.mongo.subtraction.insert_many(
        [
            {
                "_id": "complete",
                "created_at": datetime.datetime.now(),
                "nickname": "complete_nickname",
                "file": {"name": "complete_file_name", "id": "complete_file_id"},
            },
            {
                "_id": "legacy",
                "file": {"id": "legacy_file_id", "name": None},
            },
        ],
    )

    subtraction_path = ctx.data_path / "subtractions" / "legacy"
    subtraction_path.mkdir(exist_ok=True, parents=True)
    index_file = subtraction_path / "subtraction.1.bt2"
    index_file.write_text("subtraction_index")

    await upgrade(ctx)

    assert [
        subtraction async for subtraction in ctx.mongo.subtraction.find({})
    ] == snapshot(matcher=path_type({".*created_at": (datetime.datetime,)}, regex=True))
